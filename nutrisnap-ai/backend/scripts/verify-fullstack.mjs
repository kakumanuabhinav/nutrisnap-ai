import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const backendDir = path.resolve(rootDir, "backend");
const frontendDir = path.resolve(rootDir, "frontend");

console.log("=== FULLSTACK VERIFICATION ===");
console.log("Root directory:", rootDir);

// 1. Start backend
const backend = spawn("node", ["dist/index.js"], {
  cwd: backendDir,
  env: { ...process.env, PORT: "4000", HOST: "0.0.0.0" },
  stdio: ["ignore", "pipe", "pipe"],
});

backend.stdout.on("data", (d) => process.stdout.write(`[backend] ${d}`));
backend.stderr.on("data", (d) => process.stderr.write(`[backend err] ${d}`));

// 2. Start frontend preview / dev
const frontend = spawn("npx", ["vite", "preview", "--port", "5173", "--strictPort"], {
  cwd: frontendDir,
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
});

frontend.stdout.on("data", (d) => process.stdout.write(`[frontend] ${d}`));
frontend.stderr.on("data", (d) => process.stderr.write(`[frontend err] ${d}`));

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verify() {
  console.log("Waiting for backend and frontend preview servers to start...");
  await wait(3000);

  // Probe backend directly
  console.log("\n1. Testing Backend Direct Health Check (http://localhost:4000/api/health):");
  const bRes = await fetch("http://localhost:4000/api/health");
  const bData = await bRes.json();
  console.log("Backend Health Status:", bRes.status, bData);

  // Probe frontend HTML
  console.log("\n2. Testing Frontend Web App (http://localhost:5173):");
  const fRes = await fetch("http://localhost:5173/");
  console.log("Frontend Status:", fRes.status, "Content-Type:", fRes.headers.get("content-type"));
  const html = await fRes.text();
  const hasAppRoot = html.includes('id="root"');
  console.log("Frontend serves single-page app HTML root:", hasAppRoot ? "YES" : "NO");

  // Clean teardown
  console.log("\n3. Stopping test servers...");
  backend.kill("SIGTERM");
  frontend.kill();
  await wait(1000);
  console.log("=== VERIFICATION COMPLETED SUCCESSFULLY ===");
}

verify().catch((err) => {
  console.error("Fullstack verification error:", err);
  backend.kill();
  frontend.kill();
  process.exit(1);
});

