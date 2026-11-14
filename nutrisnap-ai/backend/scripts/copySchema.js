import { mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");

mkdirSync(path.join(backendRoot, "dist/db"), { recursive: true });
copyFileSync(
  path.join(backendRoot, "src/db/schema.sql"),
  path.join(backendRoot, "dist/db/schema.sql"),
);
console.log("[build] Copied schema.sql into dist/db/schema.sql");
