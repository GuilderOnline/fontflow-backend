// controllers/fontController.js
import AWS from "aws-sdk";
import * as fontkit from "fontkit";
import { fileTypeFromBuffer } from "file-type"; // ✅ Minimal fix: correct import for Render's Node version
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

    const type = await fileTypeFromBuffer(req.file.buffer);
    let originalBuffer = req.file.buffer;
    let woff2Buffer = null;

    const baseName = req.file.originalname.replace(/\.[^/.]+$/, "");
    const timestamp = Date.now();

    // Upload original file
    const originalExt = type?.ext || "ttf";
    const originalKey = `${timestamp}-${baseName}.${originalExt}`;
    await s3.putObject({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: originalKey,
      Body: originalBuffer,
      ContentType: type?.mime || "application/octet-stream",
    }).promise();

    // Convert to WOFF2 if needed
    if (["ttf", "otf"].includes(originalExt)) {
      let ttfBuffer = originalBuffer;
      if (originalExt === "otf") {
        ttfBuffer = Buffer.from(otf2ttf(originalBuffer));
      }
      woff2Buffer = Buffer.from(ttf2woff2(ttfBuffer));
    } else if (["woff", "woff2"].includes(originalExt)) {
      woff2Buffer = originalBuffer;
    }

    // Upload WOFF2 version
    const woff2Key = `${timestamp}-${baseName}.woff2`;
    await s3.putObject({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: woff2Key,
      Body: woff2Buffer,
      ContentType: "font/woff2",
    }).promise();

    // Signed URLs
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

    // Save to DB
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

/**
 * 📄 Get all fonts
 */
export const getAllFonts = async (req, res) => {
  try {
    const query = req.user.role === "admin" ? {} : { user: req.user.id };
    const fonts = await Font.find(query).sort({ createdAt: -1 });

    const fontsWithUrls = fonts.map(font => ({
      ...font.toObject(),
      originalDownloadUrl: font.originalFile ? s3.getSignedUrl("getObject", {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: font.originalFile,
        Expires: 60 * 5
      }) : null,
      woff2DownloadUrl: font.woff2File ? s3.getSignedUrl("getObject", {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: font.woff2File,
        Expires: 60 * 5
      }) : null
    }));

    res.status(200).json(fontsWithUrls);
  } catch (err) {
    console.error("❌ Error fetching fonts:", err);
    res.status(500).json({ message: "Error fetching fonts" });
  }
};

/**
 * 🗑 Delete a font
 */
export const deleteFont = async (req, res) => {
  try {
    const font = await Font.findOne({ _id: req.params.id, user: req.user.id });
    if (!font) {
      return res.status(404).json({ message: "Font not found" });
    }

    await s3.deleteObject({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: font.originalFile,
    }).promise();

    await Font.deleteOne({ _id: font._id });

    res.json({ message: "Font deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting font:", err);
    res.status(500).json({ message: "Error deleting font" });
  }
};
