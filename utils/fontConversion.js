import ttf2woff2 from "ttf2woff2";

/**
 * Convert TTF → WOFF2 (returns Buffer)
 */
export function convertTtfToWoff2(buffer) {
  try {
    if (!Buffer.isBuffer(buffer)) {
      buffer = Buffer.from(buffer);
    }
    return Buffer.from(ttf2woff2(buffer));
  } catch (err) {
    console.error("❌ TTF → WOFF2 conversion failed:", err);
    return null;
  }
}

/**
 * Ensure WOFF2 from any source font (returns Buffer)
 */
export async function ensureWoff2(buffer, ext) {
  let woff2Buffer = null;

  if (ext === "ttf") {
    woff2Buffer = convertTtfToWoff2(buffer);
  } else if (ext === "woff2") {
    woff2Buffer = buffer; // already WOFF2
  } else if (ext === "otf") {
    console.warn("⚠️ OTF conversion skipped — no fontforge in serverless env");
    return null;
  } else if (ext === "woff") {
    console.warn("⚠️ WOFF → WOFF2 not supported");
    return null;
  }

  return woff2Buffer;
}
