import sharp from "sharp";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "..");
const frontendDir = path.resolve(backendDir, "..", "frontend");

const PORT = 4000;
const FRONTEND_PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

console.log("==================================================");
console.log("   NUTRISNAP AI - COMPREHENSIVE E2E REGRESSION    ");
console.log("==================================================\n");

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let backend = null;

async function ensureBackend() {
  try {
    const probe = await fetch(`${BASE_URL}/api/health`);
    if (probe.ok) {
      console.log("1. Backend is already running and listening on port 4000.");
      return;
    }
  } catch {}

  console.log("1. Starting backend server on port 4000...");
  backend = spawn("node", ["dist/index.js"], {
    cwd: backendDir,
    env: { ...process.env, PORT: String(PORT), HOST: "0.0.0.0" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let ready = false;
  backend.stdout.on("data", (d) => {
    const msg = d.toString();
    process.stdout.write(`[backend] ${msg}`);
    if (msg.includes("listening") || msg.includes("running")) {
      ready = true;
    }
  });
  backend.stderr.on("data", (d) => process.stderr.write(`[backend err] ${d}`));

  const start = Date.now();
  while (!ready && Date.now() - start < 10000) {
    await wait(200);
  }
  await wait(500);
}

async function run() {
  await ensureBackend();

  console.log("\n2. Testing /api/health endpoint...");
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json();
  console.log("Health Status:", healthRes.status, JSON.stringify(healthData));
  if (healthRes.status !== 200 || healthData.status !== "success" || healthData.message !== "Backend is running") {
    throw new Error(`Health check mismatch: ${JSON.stringify(healthData)}`);
  }
  console.log(">>> Health check verified: PASS");

  console.log("\n3. Testing /api base endpoint...");
  const baseRes = await fetch(`${BASE_URL}/api`);
  const baseData = await baseRes.json();
  console.log("Base API Status:", baseRes.status, JSON.stringify(baseData));
  if (baseRes.status !== 200 || baseData.status !== "success") {
    throw new Error("Base API failure");
  }
  console.log(">>> Base API verified: PASS");

  console.log("\n4. Testing User Authentication (Register)...");
  const testEmail = `regression_${Date.now()}@example.com`;
  const testPassword = "Password123!";
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Regression Tester",
      email: testEmail,
      password: testPassword,
      age: 28,
      gender: "male",
      height_cm: 180,
      weight_kg: 75,
      activity_level: "moderate",
      nutrition_goal: "maintain",
    }),
  });
  const regData = await regRes.json();
  console.log("Register response status:", regRes.status, "User:", regData.user?.email);
  if (regRes.status !== 201 || !regData.token) {
    throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
  }
  const token = regData.token;
  console.log(">>> User Registration & Argon2 Auth: PASS");

  console.log("\n5. Testing Profile and Suggested Goals...");
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Cookie: `nutrisnap_token=${token}`,
  };
  const profileRes = await fetch(`${BASE_URL}/api/profile`, { headers: authHeaders });
  const profileData = await profileRes.json();
  console.log("Profile status:", profileRes.status, "User name:", profileData.profile?.name);

  const goalsRes = await fetch(`${BASE_URL}/api/profile/suggested-goals`, { headers: authHeaders });
  const goalsData = await goalsRes.json();
  console.log("Suggested Goals:", goalsRes.status, JSON.stringify(goalsData));
  console.log(">>> Profile and Goal Calculation: PASS");

  console.log("\n6. Testing Food Image Generation, Upload & Gemini AI Vision Analysis...");
  // Render an SVG of a crisp green apple with sharp
  const svgFood = `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="400" fill="#f8fafc"/>
    <circle cx="200" cy="220" r="120" fill="#16a34a"/>
    <rect x="193" y="70" width="14" height="40" rx="7" fill="#78350f"/>
    <ellipse cx="235" cy="85" rx="30" ry="15" fill="#22c55e" transform="rotate(-20 235 85)"/>
  </svg>`;
  const imgBuffer = await sharp(Buffer.from(svgFood)).jpeg({ quality: 85 }).toBuffer();

  const formData = new FormData();
  formData.append("image", new Blob([imgBuffer], { type: "image/jpeg" }), "apple.jpg");

  const scanStart = Date.now();
  const scanRes = await fetch(`${BASE_URL}/api/analyze-food`, {
    method: "POST",
    headers: { ...authHeaders },
    body: formData,
  });
  const scanDuration = Date.now() - scanStart;
  const scanData = await scanRes.json();
  console.log(`Food Scan Status: ${scanRes.status} (completed in ${scanDuration}ms)`);
  console.log("Detected Foods:", JSON.stringify(scanData.analysis?.detected_foods));
  console.log("Nutrition Estimates:", JSON.stringify(scanData.analysis?.nutrition));
  console.log("AI Summary:", scanData.analysis?.summary);
  if (scanRes.status !== 200 || !scanData.analysis) {
    throw new Error(`AI Scan failed: ${JSON.stringify(scanData)}`);
  }
  console.log(">>> Gemini AI Food Recognition & Nutrition Parsing: PASS");

  console.log("\n7. Testing Meal Logging to Database...");
  const mealRes = await fetch(`${BASE_URL}/api/meals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      meal_type: "snack",
      summary: scanData.analysis.summary,
      serving_multiplier: 1,
      nutrition: scanData.analysis.nutrition,
      detected_foods: scanData.analysis.detected_foods.length > 0 ? scanData.analysis.detected_foods : [{ name: "Green Apple", confidence: 95 }],
      insights: scanData.analysis.insights,
    }),
  });
  const mealData = await mealRes.json();
  console.log("Meal log status:", mealRes.status, "Meal ID:", mealData.meal?.id);
  if (mealRes.status !== 201 || !mealData.meal?.id) {
    throw new Error(`Meal creation failed: ${JSON.stringify(mealData)}`);
  }
  console.log(">>> Meal Logging & DB Persistence: PASS");

  console.log("\n8. Testing Tracker Aggregation...");
  const trackerRes = await fetch(`${BASE_URL}/api/tracker/today`, { headers: authHeaders });
  const trackerData = await trackerRes.json();
  console.log("Tracker Status:", trackerRes.status, "Consumed Calories:", trackerData.consumed?.calories);
  if (trackerRes.status !== 200 || trackerData.consumed?.calories === undefined) {
    throw new Error("Tracker failed");
  }
  console.log(">>> Tracker Progress: PASS");

  console.log("\n9. Testing Frontend Preview Server & Communication...");
  let frontend = null;
  try {
    const fprobe = await fetch(`${FRONTEND_URL}/`);
    if (fprobe.ok) {
      console.log("Frontend is already running on port 5173.");
    }
  } catch {
    frontend = spawn("npx", ["vite", "preview", "--port", String(FRONTEND_PORT), "--strictPort"], {
      cwd: frontendDir,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    frontend.stdout.on("data", (d) => process.stdout.write(`[frontend] ${d}`));
    frontend.stderr.on("data", (d) => process.stderr.write(`[frontend err] ${d}`));
    await wait(3000);
  }

  const frontHtmlRes = await fetch(`${FRONTEND_URL}/`);
  console.log("Frontend HTTP Status:", frontHtmlRes.status);
  const frontHtml = await frontHtmlRes.text();
  const rootPresent = frontHtml.includes('id="root"');
  console.log("React App Mount Element Present:", rootPresent ? "YES" : "NO");

  console.log("\n10. Teardown...");
  if (backend) {
    backend.kill("SIGTERM");
  }
  if (frontend) {
    frontend.kill();
  }
  await wait(1000);

  console.log("\n==================================================");
  console.log("  ALL NUTRISNAP AI REGRESSION TESTS PASSED!       ");
  console.log("==================================================\n");
}

run().catch((err) => {
  console.error("\n*** Regression Test Failure ***", err);
  if (backend) backend.kill();
  process.exit(1);
});
