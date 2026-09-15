import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadEnv() {
  const initialEnv = { ...process.env };
  const possiblePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "nutrisnap-ai", "backend", ".env"),
    path.resolve(process.cwd(), "backend", ".env"),
    path.resolve(__dirname, "..", "..", ".env"),
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
    }
  }

  // Guarantee that environment variables injected by cloud hosting platforms take precedence
  for (const [key, val] of Object.entries(initialEnv)) {
    if (val !== undefined) {
      process.env[key] = val;
    }
  }
}

loadEnv();
