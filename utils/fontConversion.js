// backend/utils/fontConversion.js
import ttf2woff2 from "ttf2woff2";
import otf2ttf from "otf2ttf";

/**
 * Convert OTF to TTF (Buffer)
 */
export function convertOtfToTtf(buffer) {
  try {
    return Buffer.from(otf2ttf(buffer));
  } catch (err) {
    console.error("❌ OTF → TTF conversion failed:", err);
    return null;
  }
}

/**
 * Convert TTF to WOFF2 (Buffer)
 */
export function convertTtfToWoff2(buffer) {
  try {
    return Buffer.from(ttf2woff2(buffer));
  } catch (err) {
    console.error("❌ TTF → WOFF2 conversion failed:", err);
    return null;
  }
}

/**
 * Ensure we have WOFF2 from any source font
 */
export function ensureWoff2(buffer, ext) {
  let woff2Buffer = null;

  if (ext === "otf") {
    const ttfBuffer = convertOtfToTtf(buffer);
    if (ttfBuffer) {
      woff2Buffer = convertTtfToWoff2(ttfBuffer);
    }
  } else if (ext === "ttf") {
    woff2Buffer = convertTtfToWoff2(buffer);
  } else if (ext === "woff2") {
    woff2Buffer = buffer; // Already WOFF2
  } else if (ext === "woff") {
    // Can't convert WOFF to WOFF2 directly — keep as is
    woff2Buffer = buffer;
  }

  return woff2Buffer;
}
