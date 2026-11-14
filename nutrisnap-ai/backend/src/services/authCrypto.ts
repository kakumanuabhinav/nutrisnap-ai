import crypto from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(crypto.scrypt);

// Safe Argon2 loader:
// On platforms/runtimes where native Argon2 is compiled and supported (e.g. Node 20/22),
// it uses Argon2. On runtimes with missing native bindings or ABI mismatches (e.g. Node 26+),
// it gracefully falls back to Node.js built-in crypto.scrypt without crashing.
let argon2Module: typeof import("argon2") | null = null;
let argon2LoadAttempted = false;

async function getArgon2(): Promise<typeof import("argon2") | null> {
  if (argon2LoadAttempted) return argon2Module;
  argon2LoadAttempted = true;
  try {
    const mod = await import("argon2");
    argon2Module = (mod.default || mod) as typeof import("argon2");
  } catch (err: any) {
    console.warn(
      `[authCrypto] Notice: Native argon2 binary not available on this runtime (${err?.message || "unsupported ABI"}). Using native crypto.scrypt fallback.`,
    );
    argon2Module = null;
  }
  return argon2Module;
}

// Preload asynchronously on module initialization
getArgon2().catch(() => {});

export const DUMMY_HASH =
  "$scrypt$n=16384,r=8,p=1$c29tZXNhbHQ$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

/**
 * Hashes a plaintext password using Argon2id (if native module available)
 * or cryptographically secure scrypt with a unique random 16-byte salt.
 */
export async function hashPassword(password: string): Promise<string> {
  const argon = await getArgon2();
  if (argon) {
    try {
      return await argon.hash(password, {
        memoryCost: 16384, // 16MB — tuned for serverless lambda memory constraints
        timeCost: 2,
        parallelism: 1,
      });
    } catch (err: any) {
      console.warn("[authCrypto] Argon2 hash failed, using scrypt fallback:", err?.message);
    }
  }

  // Pure Node.js standard library fallback (zero native compilation required)
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `$scrypt$n=16384,r=8,p=1$${salt}$${derivedKey.toString("hex")}`;
}

/**
 * Verifies a password against a stored hash. Supports both Argon2 ($argon2id$)
 * and scrypt ($scrypt$) hashes with timing-safe comparison.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  if (!hash || !plain) return false;

  // 1. Argon2 hash verification
  if (hash.startsWith("$argon2")) {
    const argon = await getArgon2();
    if (argon) {
      try {
        return await argon.verify(hash, plain);
      } catch (err: any) {
        console.warn("[authCrypto] Argon2 verify error:", err?.message);
        return false;
      }
    } else {
      console.warn("[authCrypto] Cannot verify Argon2 hash: native module not supported on this Node runtime.");
      return false;
    }
  }

  // 2. scrypt hash verification
  if (hash.startsWith("$scrypt$")) {
    try {
      const parts = hash.split("$");
      // Format: ["", "scrypt", "n=16384,r=8,p=1", salt, derivedKeyHex]
      const salt = parts[3];
      const expectedKeyHex = parts[4];
      if (!salt || !expectedKeyHex) return false;

      const derivedKey = (await scryptAsync(plain, salt, 64)) as Buffer;
      const expectedKey = Buffer.from(expectedKeyHex, "hex");

      if (derivedKey.length !== expectedKey.length) return false;
      return crypto.timingSafeEqual(derivedKey, expectedKey);
    } catch (err: any) {
      console.warn("[authCrypto] scrypt verify error:", err?.message);
      return false;
    }
  }

  return false;
}

