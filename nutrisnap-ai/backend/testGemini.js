import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(".env") });

const apiKey = process.env.GEMINI_API_KEY;
console.log("API Key configured:", !!apiKey);

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.4,
  },
});

const sampleBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

async function test() {
  try {
    const t0 = Date.now();
    const result = await model.generateContent("Say OK");
    const duration = Date.now() - t0;
    console.log("Model test result:", result.response.text().trim());
    console.log("Response time:", duration + "ms");
  } catch (err) {
    console.log("\nRAW ERROR CAUGHT:");
    console.log("Name:", err.name);
    console.log("Status:", err.status);
    console.log("Message:", err.message);
    console.log("Stack:", err.stack);
  }
}

test();
