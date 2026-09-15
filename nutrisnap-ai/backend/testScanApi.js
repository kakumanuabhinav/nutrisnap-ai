import sharp from "sharp";

const BASE_URL = "http://localhost:4000";
const EMAIL = "uitest@example.com";
const PASSWORD = "Password123!";

async function testScanWithFoodImage() {
  console.log("\n=================================");
  console.log("NutriSnap AI Food Image Test");
  console.log("=================================\n");

  console.log("1. Logging in...");
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log("Login status:", loginRes.status, "Token:", token ? "YES" : "NO");

  console.log("\n2. Creating a test food image (Red Apple illustration)...");
  // Create a 400x400 SVG graphic of a red apple and render to JPEG
  const svgFood = `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="400" fill="#f8fafc"/>
    <circle cx="200" cy="220" r="120" fill="#dc2626"/>
    <rect x="193" y="70" width="14" height="40" rx="7" fill="#78350f"/>
    <ellipse cx="235" cy="85" rx="30" ry="15" fill="#16a34a" transform="rotate(-20 235 85)"/>
  </svg>`;

  const imageBuffer = await sharp(Buffer.from(svgFood)).jpeg({ quality: 85 }).toBuffer();

  const formData = new FormData();
  formData.append("image", new Blob([imageBuffer], { type: "image/jpeg" }), "apple.jpg");

  console.log("\n3. Calling food analysis endpoint...");
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["Cookie"] = `nutrisnap_token=${token}`;
  }

  const startTime = performance.now();
  const scanRes = await fetch(`${BASE_URL}/api/analyze-food`, {
    method: "POST",
    headers,
    body: formData,
  });
  const totalMs = Math.round(performance.now() - startTime);

  const scanData = await scanRes.json();

  console.log("\n=================================");
  console.log("SCAN RESULT (Status:", scanRes.status, "Total Time:", totalMs, "ms)");
  console.log("=================================");
  console.log(JSON.stringify(scanData, null, 2));
}

testScanWithFoodImage().catch(console.error);
