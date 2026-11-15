import "../utils/env.js";
import { Client } from "pg";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SCHEMA_SQL, REQUIRED_TABLES } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check whether strict production migration is requested
const isStrict =
  process.argv.includes("--strict") ||
  process.argv.includes("--prod") ||
  process.env.MIGRATE_STRICT === "true" ||
  process.env.NODE_ENV === "production";

function sanitizeUrl(rawUrl?: string): {
  provider: string;
  hostname: string;
  database: string;
  ssl: string;
} {
  if (!rawUrl) {
    return {
      provider: "None",
      hostname: "[missing]",
      database: "[missing]",
      ssl: "Disabled",
    };
  }
  try {
    const url = new URL(rawUrl);
    const isRemote = url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
    const isNeon = url.hostname.includes("neon.tech");
    return {
      provider: isNeon ? "Neon PostgreSQL" : isRemote ? "Remote PostgreSQL" : "Local PostgreSQL",
      hostname: url.hostname,
      database: url.pathname.replace(/^\//, "") || "postgres",
      ssl: isNeon || isRemote || rawUrl.includes("sslmode=require") ? "Enabled (TLS / SNI)" : "Disabled",
    };
  } catch {
    return {
      provider: "PostgreSQL",
      hostname: "[invalid URL format]",
      database: "[unknown]",
      ssl: "Unknown",
    };
  }
}

async function runProductionMigration(dbUrl: string) {
  const meta = sanitizeUrl(dbUrl);

  console.log("==================================================");
  console.log("   NUTRISNAP AI - PRODUCTION DATABASE MIGRATION   ");
  console.log("==================================================");
  console.log("Database Provider :", meta.provider);
  console.log("Database Hostname :", meta.hostname);
  console.log("Database Name     :", meta.database);
  console.log("TLS / SSL Status  :", meta.ssl);
  console.log("Mode              : Direct pg.Client (Strict - No Fallback)");
  console.log("--------------------------------------------------");

  if (!dbUrl) {
    console.error("\n[migrate:prod] FATAL: DATABASE_URL is missing.");
    console.error("[migrate:prod] Production migration requires a valid remote PostgreSQL connection string.");
    console.error("[migrate:prod] Example usage: DATABASE_URL=\"postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require\" npm run migrate:prod");
    process.exit(1);
  }

  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch (err: any) {
    console.error("\n[migrate:prod] FATAL: Invalid DATABASE_URL format:", err?.message || err);
    process.exit(1);
  }

  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
    console.error("\n[migrate:prod] FATAL: DATABASE_URL points to localhost/127.0.0.1.");
    console.error("[migrate:prod] Production migration requires a remote PostgreSQL database (e.g. Neon).");
    console.error("[migrate:prod] Pass the remote connection string explicitly:");
    console.error("  DATABASE_URL=\"postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require\" npm run migrate:prod");
    process.exit(1);
  }

  const isRemote = parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1";
  const isNeon = parsed.hostname.includes("neon.tech");
  const useSsl = isNeon || isRemote || dbUrl.includes("sslmode=require");

  const client = new Client({
    connectionString: dbUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15_000,
  });

  try {
    console.log("Connecting directly to PostgreSQL via pg.Client...");
    await client.connect();
    console.log("✓ Connected successfully to remote PostgreSQL database.");
  } catch (err: any) {
    console.error(`\n[migrate:prod] FATAL: Connection failed to remote database (${err.code || err.message}).`);
    console.error("[migrate:prod] Strict mode is active: will NEVER silently fall back to PGlite. Aborting with non-zero exit code.");
    process.exit(1);
  }

  try {
    console.log("Applying idempotent DDL schema (CREATE TABLE IF NOT EXISTS)...");
    await client.query(SCHEMA_SQL);
    console.log("✓ DDL statements executed successfully (no tables dropped, existing data preserved).");

    console.log("Verifying tables directly via information_schema.tables...");
    const result = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    const tableNames = result.rows.map((r) => r.table_name);
    console.log("Found public tables in database:", tableNames.join(", "));

    const missing = REQUIRED_TABLES.filter((t) => !tableNames.includes(t));
    if (missing.length > 0) {
      console.error(`\n[migrate:prod] FATAL: Verification failed. Missing expected tables: ${missing.join(", ")}`);
      await client.end();
      process.exit(1);
    }

    console.log("--------------------------------------------------");
    console.log(`✓ Verification successful: All ${REQUIRED_TABLES.length} required application tables verified active on remote Neon database!`);
    console.log("==================================================\n");

    await client.end();
    process.exit(0);
  } catch (err: any) {
    console.error(`\n[migrate:prod] FATAL: Migration query failed:`, err.message);
    try {
      await client.end();
    } catch {}
    process.exit(1);
  }
}

async function runLocalMigration() {
  // Local development migration path (uses HybridPool with PGlite fallback support)
  const { pool } = await import("./pool.js");
  const meta = sanitizeUrl(process.env.DATABASE_URL);

  console.log("==================================================");
  console.log("   NUTRISNAP AI - LOCAL DATABASE MIGRATION        ");
  console.log("==================================================");
  console.log("Target Database   :", meta.hostname === "localhost" ? "Local PostgreSQL / PGlite" : meta.hostname);
  console.log("Mode              : Local Development");
  console.log("--------------------------------------------------");

  await pool.exec(SCHEMA_SQL);
  console.log("✓ Applied schema DDL successfully.");

  const result = await pool.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  const tables = result.rows.map((r) => r.table_name);
  console.log("Verified tables in database:", tables.join(", "));

  const missing = REQUIRED_TABLES.filter((t) => !tables.includes(t));
  if (missing.length > 0) {
    throw new Error(`Missing expected tables after migration: ${missing.join(", ")}`);
  }

  console.log(`✓ All ${REQUIRED_TABLES.length} required application tables verified active!`);
  console.log("==================================================\n");

  await pool.end();
  process.exit(0);
}

// Route to strict production runner or local development runner
const rawUrl = process.env.DATABASE_URL || "";
const isRemoteUrl = rawUrl.includes("neon.tech") || (!rawUrl.includes("localhost") && !rawUrl.includes("127.0.0.1") && rawUrl.startsWith("postgres"));

if (isStrict || isRemoteUrl) {
  runProductionMigration(rawUrl).catch((err) => {
    console.error("\n[migrate:prod] Fatal unhandled error:", err.message);
    process.exit(1);
  });
} else {
  runLocalMigration().catch((err) => {
    console.error("\n[migrate] Local migration failed:", err.message);
    process.exit(1);
  });
}
