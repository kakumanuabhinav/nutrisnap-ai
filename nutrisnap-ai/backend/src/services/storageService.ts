import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { getSharp } from "./imageOptimizer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "..", "..");
const isVercel = !!process.env.VERCEL;
const UPLOAD_DIR = isVercel
  ? path.join(os.tmpdir(), "uploads")
  : existsSync(path.resolve(backendDir, "uploads"))
    ? path.resolve(backendDir, "uploads")
    : existsSync(path.resolve(process.cwd(), "nutrisnap-ai", "backend", "uploads"))
      ? path.resolve(process.cwd(), "nutrisnap-ai", "backend", "uploads")
      : path.resolve(backendDir, "uploads");

/**
 * Compresses and stores an image, returning a public URL.
 *
 * STORAGE_DRIVER=local writes to disk and serves via /uploads (fine for a
 * single-instance dev/demo deployment). For real production, swap this
 * function's body for an S3/GCS/Supabase Storage upload and return the
 * resulting object URL — nothing else in the app needs to change, since
 * every caller only ever sees the returned URL string.
 */
export async function storeImage(buffer: Buffer, mimeType: string): Promise<string> {
  const driver = process.env.STORAGE_DRIVER || "local";
  const sharp = await getSharp();
  let compressed: Buffer;
  let ext: string;

  if (sharp) {
    try {
      compressed = await sharp(buffer)
        .resize({ width: 1280, withoutEnlargement: true })
        .jpeg({ quality: 78 })
        .toBuffer();
      ext = "jpg";
    } catch (err: any) {
      console.warn("[storage] Sharp compression failed, storing raw buffer:", err?.message);
      compressed = buffer;
      ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    }
  } else {
    compressed = buffer;
    ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  }

  const filename = `${crypto.randomUUID()}.${ext}`;

  if (driver === "local") {
    try {
      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(path.join(UPLOAD_DIR, filename), compressed);
    } catch (err: any) {
      console.warn("[storage] Warning writing to upload directory:", err.message);
    }
    const publicBase =
      process.env.BACKEND_PUBLIC_URL ||
      process.env.APP_URL ||
      process.env.PUBLIC_URL ||
      "";
    if (publicBase) {
      return `${publicBase.replace(/\/+$/, "")}/uploads/${filename}`;
    }
    if (process.env.NODE_ENV === "production") {
      return `/uploads/${filename}`;
    }
    const port = process.env.PORT || 4000;
    return `http://localhost:${port}/uploads/${filename}`;
  }

  // Placeholder for real object storage drivers.
  throw new Error(`Unsupported STORAGE_DRIVER "${driver}" — implement it in storageService.ts`);
}
