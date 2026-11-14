import { mkdirSync, copyFileSync, writeFileSync } from "node:fs";
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

// Ensure dist/ contains a package.json declaring type: module so AWS Lambda / Vercel
// executes the serverless bundle as an ES Module even when isolated in /var/task.
const distPkg = {
  type: "module",
  main: "index.js"
};
writeFileSync(
  path.join(backendRoot, "dist/package.json"),
  JSON.stringify(distPkg, null, 2) + "\n"
);
console.log("[build] Generated dist/package.json with type: module");

// Also ensure api/ contains a package.json declaring type: module if invoked directly
mkdirSync(path.join(backendRoot, "api"), { recursive: true });
writeFileSync(
  path.join(backendRoot, "api/package.json"),
  JSON.stringify({ type: "module" }, null, 2) + "\n"
);
console.log("[build] Generated api/package.json with type: module");
