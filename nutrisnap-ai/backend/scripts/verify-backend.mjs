import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "..");

console.log("=== STEP 1: Starting Backend Server ===");
const backendProcess = spawn("node", ["dist/index.js"], {
  cwd: backendDir,
  env: { ...process.env, PORT: "4000", HOST: "0.0.0.0" },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverReady = false;
backendProcess.stdout.on("data", (data) => {
  const text = data.toString();
  process.stdout.write(`[backend stdout] ${text}`);
  if (text.includes("NutriSnap AI backend listening") || text.includes("NutriSnap AI backend running")) {
    serverReady = true;
  }
});

backendProcess.stderr.on("data", (data) => {
  process.stderr.write(`[backend stderr] ${data.toString()}`);
});

backendProcess.on("exit", (code, signal) => {
  console.log(`Backend process exited with code ${code}, signal ${signal}`);
});

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (serverReady) {
      // give an extra 500ms for routes to bind
      await new Promise((r) => setTimeout(r, 500));
      return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function runTests() {
  const ready = await waitForServer();
  if (!ready) {
    console.error("Backend server did not report ready in time!");
    backendProcess.kill();
    process.exit(1);
  }

  console.log("\n=== STEP 2: Testing Health-Check Endpoint (GET http://localhost:4000/api/health) ===");
  const healthRes = await fetch("http://localhost:4000/api/health");
  console.log("Status:", healthRes.status);
  const healthJson = await healthRes.json();
  console.log("Response JSON:", JSON.stringify(healthJson, null, 2));

  if (healthRes.status !== 200 || healthJson.status !== "success" || healthJson.message !== "Backend is running") {
    console.error("Health check response failed expectations!");
  } else {
    console.log(">>> Health check passed successfully!");
  }

  console.log("\n=== STEP 3: Testing Base API Endpoint (GET http://localhost:4000/api) ===");
  const baseRes = await fetch("http://localhost:4000/api");
  console.log("Status:", baseRes.status);
  const baseJson = await baseRes.json();
  console.log("Response JSON:", JSON.stringify(baseJson, null, 2));

  console.log("\n=== STEP 4: Testing Auth Login Endpoint (POST http://localhost:4000/api/auth/login) ===");
  const loginRes = await fetch("http://localhost:4000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nonexistent@example.com", password: "Password123!" }),
  });
  console.log("Status:", loginRes.status);
  const loginJson = await loginRes.json();
  console.log("Response JSON:", JSON.stringify(loginJson, null, 2));

  console.log("\n=== STEP 5: Testing User Registration & Database CRUD ===");
  const testEmail = `test_${Date.now()}@example.com`;
  const registerRes = await fetch("http://localhost:4000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test User",
      email: testEmail,
      password: "TestPassword123!",
      nutrition_goal: "maintain",
    }),
  });
  console.log("Register status:", registerRes.status);
  const registerJson = await registerRes.json();
  console.log("Register response:", JSON.stringify(registerJson, null, 2));

  if (registerRes.status === 201 && registerJson.token) {
    console.log("\n=== STEP 6: Testing Authenticated Profile Route ===");
    const profileRes = await fetch("http://localhost:4000/api/profile", {
      headers: {
        Authorization: `Bearer ${registerJson.token}`,
      },
    });
    console.log("Profile status:", profileRes.status);
    const profileJson = await profileRes.json();
    console.log("Profile response:", JSON.stringify(profileJson, null, 2));

    console.log("\n=== STEP 7: Testing Tracker Route ===");
    const trackerRes = await fetch("http://localhost:4000/api/tracker/today", {
      headers: {
        Authorization: `Bearer ${registerJson.token}`,
      },
    });
    console.log("Tracker status:", trackerRes.status);
    const trackerJson = await trackerRes.json();
    console.log("Tracker response:", JSON.stringify(trackerJson, null, 2));
  }

  console.log("\n=== STEP 8: Cleanup and Teardown ===");
  backendProcess.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 1000));
  console.log("Backend process terminated cleanly.");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  backendProcess.kill();
  process.exit(1);
});

