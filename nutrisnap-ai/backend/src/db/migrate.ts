import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schemaCandidates = [
    path.join(__dirname, "schema.sql"),
    path.join(__dirname, "..", "src", "db", "schema.sql"),
    path.resolve(process.cwd(), "src", "db", "schema.sql"),
    path.resolve(process.cwd(), "nutrisnap-ai", "backend", "src", "db", "schema.sql"),
  ];
  const schemaPath = schemaCandidates.find((p) => existsSync(p)) || path.join(__dirname, "schema.sql");
  const sql = readFileSync(schemaPath, "utf-8");
  console.log("Running migrations against", process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@"));
  await pool.exec(sql);
  console.log("Migrations complete.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
