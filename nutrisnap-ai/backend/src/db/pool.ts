import { Pool, QueryResult } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface DBClient {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
  release(): void;
}

class HybridPool {
  private pgPool: Pool | null = null;
  private pglite: PGlite | null = null;
  private isFallback = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (process.env.DATABASE_URL) {
      const isRemotePg =
        !process.env.DATABASE_URL.includes("localhost") &&
        !process.env.DATABASE_URL.includes("127.0.0.1");
      const useSsl =
        process.env.DATABASE_SSL === "true" ||
        (process.env.NODE_ENV === "production" && isRemotePg);

      this.pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: Number(process.env.DB_POOL_MAX || 10),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 5000),
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      });

      this.pgPool.on("error", (err) => {
        console.error("[db] Unexpected error on idle Postgres client", err);
      });
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      if (this.pgPool) {
        try {
          // Quick probe to check if Postgres is actually running and reachable
          const client = await this.pgPool.connect();
          client.release();
          console.log("[db] Connected to PostgreSQL at", process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@"));
          return;
        } catch (err: any) {
          console.warn(`[db] Could not connect to PostgreSQL (${err.code || err.message}). Switching to local PGlite embedded database fallback.`);
          this.isFallback = true;
        }
      } else {
        console.warn("[db] DATABASE_URL is not set. Using local PGlite embedded database.");
        this.isFallback = true;
      }

      if (this.isFallback && !this.pglite) {
        const isVercel = !!process.env.VERCEL;
        const backendDir = path.resolve(__dirname, "..", "..");
        const dataDir = isVercel
          ? path.join(os.tmpdir(), "data")
          : existsSync(path.resolve(backendDir, "data"))
            ? path.resolve(backendDir, "data")
            : existsSync(path.resolve(process.cwd(), "nutrisnap-ai", "backend", "data"))
              ? path.resolve(process.cwd(), "nutrisnap-ai", "backend", "data")
              : path.resolve(backendDir, "data");

        try {
          mkdirSync(dataDir, { recursive: true });
        } catch (e: any) {
          console.warn("[db] Notice: Unable to create data dir:", e.message);
        }
        this.pglite = new PGlite(path.resolve(dataDir, "nutrisnap.db"));

        // Auto-run schema migration on PGlite
        const schemaCandidates = [
          path.join(__dirname, "schema.sql"),
          path.join(__dirname, "..", "src", "db", "schema.sql"),
          path.resolve(backendDir, "src", "db", "schema.sql"),
          path.resolve(backendDir, "dist", "db", "schema.sql"),
          path.resolve(process.cwd(), "src", "db", "schema.sql"),
          path.resolve(process.cwd(), "nutrisnap-ai", "backend", "src", "db", "schema.sql"),
        ];
        const schemaPath = schemaCandidates.find((p) => existsSync(p)) || path.join(__dirname, "schema.sql");
        const sql = readFileSync(schemaPath, "utf-8");
        const cleanSql = sql
          .replace(/CREATE EXTENSION IF NOT EXISTS citext;/g, "")
          .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g, "")
          .replace(/\bCITEXT\b/g, "TEXT");

        await this.pglite.exec(cleanSql);
        console.log("[db] Local PGlite embedded database ready.");
      }
    })();
    return this.initPromise;
  }

  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    await this.ensureInitialized();
    if (!this.isFallback && this.pgPool) {
      try {
        const res: QueryResult = await this.pgPool.query(text, params);
        return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
      } catch (err: any) {
        const isConnErr =
          err.code === "ECONNREFUSED" ||
          err.code === "57P01" ||
          err.code === "EACCES" ||
          err.code === "ETIMEDOUT" ||
          err.code === "ENOTFOUND" ||
          err.code === "ECONNRESET" ||
          err.code === "EHOSTUNREACH" ||
          err.code === "EADDRNOTAVAIL";
        if (isConnErr) {
          console.warn(`[db] Postgres connection error (${err.code || err.message}). Switching to local PGlite fallback.`);
          this.isFallback = true;
          this.initPromise = null;
          await this.ensureInitialized();
          return this.query<T>(text, params);
        }
        throw err;
      }
    }

    if (this.pglite) {
      const res = await this.pglite.query<T>(text, params);
      return { rows: res.rows, rowCount: res.rows.length };
    }

    throw new Error("No database engine initialized.");
  }

  async exec(sql: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.isFallback && this.pgPool) {
      try {
        await this.pgPool.query(sql);
        return;
      } catch (err: any) {
        console.warn(`[db] Postgres exec error (${err.code || err.message}). Switching to local PGlite fallback.`);
        this.isFallback = true;
        this.initPromise = null;
        await this.ensureInitialized();
      }
    }
    if (this.pglite) {
      const cleanSql = sql
        .replace(/CREATE EXTENSION IF NOT EXISTS citext;/g, "")
        .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g, "")
        .replace(/\bCITEXT\b/g, "TEXT");
      await this.pglite.exec(cleanSql);
      return;
    }
    throw new Error("No database engine initialized.");
  }

  async connect(): Promise<DBClient> {
    await this.ensureInitialized();
    if (!this.isFallback && this.pgPool) {
      try {
        const client = await this.pgPool.connect();
        return {
          query: async <T = any>(text: string, params?: any[]) => {
            const res = await client.query(text, params);
            return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
          },
          release: () => client.release(),
        };
      } catch (err: any) {
        console.warn(`[db] Postgres connect error (${err.code || err.message}). Switching to local PGlite fallback.`);
        this.isFallback = true;
        this.initPromise = null;
        await this.ensureInitialized();
      }
    }

    if (this.pglite) {
      const db = this.pglite;
      return {
        query: async <T = any>(text: string, params?: any[]) => {
          const res = await db.query<T>(text, params);
          return { rows: res.rows, rowCount: res.rows.length };
        },
        release: () => {
          // No-op for PGlite single process instance
        },
      };
    }

    throw new Error("No database engine initialized.");
  }

  on(event: any, listener: (...args: any[]) => void) {
    if (this.pgPool) {
      this.pgPool.on(event, listener);
    }
  }

  async end() {
    if (this.pgPool) {
      await this.pgPool.end();
    }
    if (this.pglite) {
      await this.pglite.close();
    }
  }
}

export const pool = new HybridPool();
