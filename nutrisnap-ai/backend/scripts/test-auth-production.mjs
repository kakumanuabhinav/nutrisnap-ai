import supertest from "supertest";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import the Express app from dist (which is what api/index.js serves on Vercel)
const { default: app } = await import("../dist/index.js");

const request = supertest(app);

console.log("==================================================");
console.log("   NUTRISNAP AI - AUTHENTICATION SUITE TEST       ");
console.log("==================================================\n");

async function runTests() {
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = "Password123!Secure";
  let token = "";
  let cookie = "";

  console.log("1. Testing POST /api/auth/register...");
  const regRes = await request
    .post("/api/auth/register")
    .send({
      name: "Vercel Test User",
      email: testEmail,
      password: testPassword,
      age: 28,
      gender: "female",
      height_cm: 165,
      weight_kg: 60,
      activity_level: "moderate",
      nutrition_goal: "maintain",
    });

  console.log("   Status:", regRes.status);
  console.log("   Body:", JSON.stringify(regRes.body));
  if (regRes.status !== 201 || !regRes.body.token) {
    throw new Error(`Registration failed with status ${regRes.status}: ${JSON.stringify(regRes.body)}`);
  }
  token = regRes.body.token;
  cookie = regRes.headers["set-cookie"]?.[0] || "";
  console.log("   ✓ Registration succeeded, received token & cookie.");

  console.log("\n2. Testing POST /api/auth/login with correct password...");
  const loginRes = await request
    .post("/api/auth/login")
    .send({
      email: testEmail,
      password: testPassword,
    });

  console.log("   Status:", loginRes.status);
  console.log("   Body:", JSON.stringify(loginRes.body));
  if (loginRes.status !== 200 || !loginRes.body.token) {
    throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.body)}`);
  }
  console.log("   ✓ Login succeeded.");

  console.log("\n3. Testing POST /api/auth/login with WRONG password...");
  const wrongLoginRes = await request
    .post("/api/auth/login")
    .send({
      email: testEmail,
      password: "WrongPassword999!",
    });

  console.log("   Status:", wrongLoginRes.status);
  if (wrongLoginRes.status !== 401) {
    throw new Error(`Expected 401 for wrong password, got ${wrongLoginRes.status}`);
  }
  console.log("   ✓ Correctly rejected with 401.");

  console.log("\n4. Testing GET /api/auth/me with Bearer token...");
  const meBearerRes = await request
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${token}`);

  console.log("   Status:", meBearerRes.status);
  console.log("   Body:", JSON.stringify(meBearerRes.body));
  if (meBearerRes.status !== 200 || meBearerRes.body.user?.email !== testEmail) {
    throw new Error(`GET /me with Bearer failed: ${JSON.stringify(meBearerRes.body)}`);
  }
  console.log("   ✓ GET /me with Bearer token passed.");

  console.log("\n5. Testing GET /api/auth/me with Cookie...");
  const meCookieRes = await request
    .get("/api/auth/me")
    .set("Cookie", cookie);

  console.log("   Status:", meCookieRes.status);
  console.log("   Body:", JSON.stringify(meCookieRes.body));
  if (meCookieRes.status !== 200 || meCookieRes.body.user?.email !== testEmail) {
    throw new Error(`GET /me with Cookie failed: ${JSON.stringify(meCookieRes.body)}`);
  }
  console.log("   ✓ GET /me with Cookie passed.");

  console.log("\n6. Testing GET /api/auth/me WITHOUT token (unauthenticated)...");
  const meUnauthRes = await request.get("/api/auth/me");
  console.log("   Status:", meUnauthRes.status);
  if (meUnauthRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated request, got ${meUnauthRes.status}`);
  }
  console.log("   ✓ Correctly returned 401.");

  console.log("\n7. Testing Vercel serverless entrypoint api/index.js...");
  const { default: serverlessApp } = await import("../api/index.js");
  const serverlessRequest = supertest(serverlessApp);
  const healthRes = await serverlessRequest.get("/api/health");
  console.log("   Status:", healthRes.status);
  console.log("   Body:", JSON.stringify(healthRes.body));
  if (healthRes.status !== 200 || healthRes.body.status !== "success") {
    throw new Error(`api/index.js health check failed: ${JSON.stringify(healthRes.body)}`);
  }
  console.log("   ✓ Serverless entrypoint api/index.js is working perfectly.");

  console.log("\n==================================================");
  console.log("   ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY!  ");
  console.log("==================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("\nTEST SUITE FAILED:", err);
  process.exit(1);
});
