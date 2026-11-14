import "../utils/env.js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function maskUrl(url?: string): string {
  if (!url) return "[none]";
  return url.replace(/:[^:@]+@/, ":****@");
}

async function migrate() {
  const backendDir = path.resolve(__dirname, "..", "..");
  const schemaCandidates = [
    path.join(__dirname, "schema.sql"),
    path.join(__dirname, "..", "src", "db", "schema.sql"),
    path.resolve(backendDir, "src", "db", "schema.sql"),
    path.resolve(backendDir, "dist", "db", "schema.sql"),
    path.resolve(process.cwd(), "src", "db", "schema.sql"),
    path.resolve(process.cwd(), "dist", "db", "schema.sql"),
    path.resolve(process.cwd(), "nutrisnap-ai", "backend", "src", "db", "schema.sql"),
    path.resolve(process.cwd(), "nutrisnap-ai", "backend", "dist", "db", "schema.sql"),
  ];
  const schemaPath = schemaCandidates.find((p) => existsSync(p)) || path.join(__dirname, "schema.sql");
  if (!existsSync(schemaPath)) {
    throw new Error(`schema.sql not found at any candidate location. Checked: ${schemaCandidates.join(", ")}`);
  }

  const sql = readFileSync(schemaPath, "utf-8");
  console.log("==================================================");
  console.log("   NUTRISNAP AI - DATABASE SCHEMA MIGRATION       ");
  console.log("==================================================");
  console.log("Target Database:", maskUrl(process.env.DATABASE_URL));

  await pool.exec(sql);
  console.log("✓ Applied schema.sql successfully.");

  // Verify all required tables are present
  const result = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' 
     ORDER BY table_name`,
  );
  const tables = result.rows.map((r) => r.table_name);
  console.log("✓ Verified tables in database:", tables.join(", "));

  const requiredTables = [
    "users",
    "user_profiles",
    "password_reset_tokens",
    "meals",
    "meal_foods",
    "meal_insights",
    "daily_goals",
  ];
  const missing = requiredTables.filter((t) => !tables.includes(t));
  if (missing.length > 0) {
    throw new Error(`Missing expected tables after migration: ${missing.join(", ")}`);
  }

  console.log("✓ All 7 required application tables are verified and active!");
  console.log("==================================================\n");
  await pool.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("\n[db] Migration failed:", err.message);
  process.exit(1);
});
