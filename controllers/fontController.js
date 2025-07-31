import AWS from "aws-sdk";
import fontkit from "fontkit";
import pkg from "file-type"; // ✅ Correct import for ESM
const { fileTypeFromBuffer } = pkg;

import ttf2woff2 from "ttf2woff2";
import otf2ttf from "otf2ttf";
import Font from "../models/fontModel.js";

// ✅ Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/**
 * 📤 Upload a font (TTF/OTF/WOFF/WOFF2)
 */
export const uploadFont = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "No font file uploaded" });
    }

    // 1️⃣ Detect file type
    const type = await fileTypeFromBuffer(req.file.buffer);
    let originalExt = type?.ext || "ttf";
    let originalBuffer = req.file.buffer;
    let woff2Buffer = null;

    // 2️⃣ Generate unique file names
    const baseName = req.file.originalname.replace(/\.[^/.]+$/, "");
    const timestamp = Date.now();

    const originalKey = `${timestamp}-${baseName}.${originalExt}`;
    const woff2Key = `${timestamp}-${baseName}.woff2`;

    // 3️⃣ Upload original file to S3
    await s3
      .putObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: originalKey,
        Body: originalBuffer,
        ContentType: type?.mime || "application/octet-stream",
      })
      .promise();

    // 4️⃣ Convert to WOFF2 if needed
    if (["ttf", "otf"].includes(originalExt)) {
      let ttfBuffer = originalBuffer;
      if (originalExt === "otf") {
        ttfBuffer = Buffer.from(otf2ttf(originalBuffer));
      }
      woff2Buffer = Buffer.from(ttf2woff2(ttfBuffer));
    } else if (originalExt === "woff") {
      // Convert WOFF → WOFF2
      const ttfBuffer = Buffer.from(originalBuffer); // sometimes works directly
      woff2Buffer = Buffer.from(ttf2woff2(ttfBuffer));
    } else if (originalExt === "woff2") {
      woff2Buffer = originalBuffer; // Already WOFF2
    }

    // 5️⃣ Upload WOFF2 version
    if (woff2Buffer) {
      await s3
        .putObject({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: woff2Key,
          Body: woff2Buffer,
          ContentType: "font/woff2",
        })
        .promise();
    }

    // 6️⃣ Create signed URLs (valid for 7 days)
    const originalUrl = s3.getSignedUrl("getObject", {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: originalKey,
      Expires: 7 * 24 * 60 * 60,
    });

    const woff2Url = s3.getSignedUrl("getObject", {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: woff2Key,
      Expires: 7 * 24 * 60 * 60,
    });

    // 7️⃣ Extract metadata
    const fontData = fontkit.create(woff2Buffer || originalBuffer);

    // 8️⃣ Save in MongoDB
    const newFont = await Font.create({
      name: req.file.originalname,
      originalFile: originalKey,
      woff2File: woff2Key,
      user: req.user.id,
      family: fontData.familyName || "",
      fullName: fontData.fullName || "",
      style: fontData.subfamilyName || "",
      originalDownloadUrl: originalUrl,
      woff2DownloadUrl: woff2Url,
    });

    console.log(`✅ Uploaded ${originalExt} + WOFF2 to S3 for ${baseName}`);
    res.json(newFont);
  } catch (error) {
    console.error("❌ Font upload failed:", error);
    res.status(500).json({ message: "Font upload failed" });
  }
};
