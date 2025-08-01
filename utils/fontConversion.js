// src/utils/fontConversion.js
import ttf2woff2 from "ttf2woff2";
import otf2ttf from "otf2ttf";
import { Readable } from "stream";

/**
 * Helper: Convert a Node stream into a Buffer
 */
function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/**
 * Convert OTF → TTF (returns Buffer)
 */
export async function convertOtfToTtf(buffer) {
  try {
    if (!Buffer.isBuffer(buffer)) {
      buffer = Buffer.from(buffer);
    }

    // otf2ttf is stream-based, so we need to pipe it
    const inputStream = Readable.from(buffer);
    const transform = otf2ttf();

    const ttfBuffer = await streamToBuffer(inputStream.pipe(transform));
    return ttfBuffer;
  } catch (err) {
    console.error("❌ OTF → TTF conversion failed:", err);
    return null;
  }
}

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

  if (ext === "otf") {
    const ttfBuffer = await convertOtfToTtf(buffer);
    if (ttfBuffer) {
      woff2Buffer = convertTtfToWoff2(ttfBuffer);
    }
  } else if (ext === "ttf") {
    woff2Buffer = convertTtfToWoff2(buffer);
  } else if (ext === "woff2") {
    woff2Buffer = buffer; // already WOFF2
  } else if (ext === "woff") {
    // Can't directly convert WOFF → WOFF2, keep original
    woff2Buffer = buffer;
  }

  return woff2Buffer;
}
