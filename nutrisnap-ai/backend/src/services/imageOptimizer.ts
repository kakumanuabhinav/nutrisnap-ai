let sharpModule: typeof import("sharp") | null = null;
let sharpLoadAttempted = false;

/**
 * Safe, lazy dynamic loader for sharp.
 * If the native Linux/Windows C++ binary is missing or incompatible,
 * it returns null rather than crashing module evaluation at startup.
 */
export async function getSharp(): Promise<typeof import("sharp") | null> {
  if (sharpLoadAttempted) return sharpModule;
  sharpLoadAttempted = true;
  try {
    const mod = await import("sharp");
    sharpModule = (mod.default || mod) as typeof import("sharp");
    console.log("[sharp] Native sharp module loaded successfully.");
  } catch (err: any) {
    console.warn(
      `[sharp] Notice: Native sharp module unavailable on this runtime (${err?.message || "unsupported binary"}). Falling back to uncompressed image pipeline.`,
    );
    sharpModule = null;
  }
  return sharpModule;
}

/**
 * Checks whether sharp is available on the current runtime without throwing.
 */
export async function isSharpAvailable(): Promise<boolean> {
  const sharp = await getSharp();
  return sharp !== null;
}

