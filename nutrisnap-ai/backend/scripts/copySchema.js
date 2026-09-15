import { mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";

mkdirSync("dist/db", { recursive: true });
copyFileSync("src/db/schema.sql", "dist/db/schema.sql");
console.log("[build] Copied schema.sql into dist/db/schema.sql");
