// controllers/fontController.js
import AWS from "aws-sdk";
import * as fontkit from "fontkit";
import fileType from "file-type";   // ✅ default import (works on Render/Bun)
import ttf2woff2 from "ttf2woff2";
import otf2ttf from "otf2ttf";
import Font from "../models/fontModel.js";

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/**
 * 📤 Upload and process font
 */
export const uploadFont = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "No font file uploaded" });
    }

    // ✅ This was the working method before — DO NOT CHANGE
    const type = await fileType.fromBuffer(req.file.buffer);

    let originalBuffer = req.file.buffer;
    let woff2Buffer = null;

    // Generate unique names
    const baseName = req.file.originalname.replace(/\.[^/.]+$/, "");
    const timestamp = Date.now();

    // Upload original file
    const originalExt = type?.ext || "ttf";
    const originalKey = `${timestamp}-${baseName}.${originalExt}`;
    await s3
      .putObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: originalKey,
        Body: originalBuffer,
        ContentType: type?.mime || "application/octet-stream",
      })
      .promise();

    // Convert to WOFF2 if needed
    if (["ttf", "otf"].includes(originalExt)) {
      let ttfBuffer = originalBuffer;
      if (originalExt === "otf") {
        ttfBuffer = Buffer.from(otf2ttf(originalBuffer));
      }
      woff2Buffer = Buffer.from(ttf2woff2(ttfBuffer));
    } else if (["woff", "woff2"].includes(originalExt)) {
      woff2Buffer = originalBuffer; // No conversion needed
    }

    // Upload WOFF2 version
    const woff2Key = `${timestamp}-${baseName}.woff2`;
    await s3
      .putObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: woff2Key,
        Body: woff2Buffer,
        ContentType: "font/woff2",
      })
      .promise();

    // Create signed download URLs (valid for 7 days)
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

    // Extract metadata
    const font = fontkit.create(woff2Buffer);

    // Save in MongoDB
    const newFont = await Font.create({
      name: req.file.originalname,
      originalFile: originalKey,
      woff2File: woff2Key,
      user: req.user.id,
      family: font.familyName || "",
      fullName: font.fullName || "",
      style: font.subfamilyName || "",
      originalDownloadUrl: originalUrl,
      woff2DownloadUrl: woff2Url,
    });

    res.json(newFont);
  } catch (error) {
    console.error("❌ Font upload failed:", error);
    res.status(500).json({ message: "Font upload failed" });
  }
};
