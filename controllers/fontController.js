// controllers/fontController.js
import AWS from "aws-sdk";
import * as fontkit from "fontkit"; // ✅ FIXED for ESM
import fileType from "file-type";   // ✅ Import entire package (works on Render's Node + file-type v16)
import Font from "../models/fontModel.js";
import { ensureWoff2 } from '../utils/fontConversion.js';



// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/**
 * 📤 Upload a font
 */
import AWS from "aws-sdk";
import path from "path";
import Font from "../models/fontModel.js";
import { ensureWoff2 } from "../utils/fontConversion.js"; // updated safe version

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/**
 * 📤 Upload a font
 */
export const uploadFont = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "No font file uploaded" });
    }

    const originalFileName = req.file.originalname;
    const ext = path.extname(originalFileName).replace(".", "").toLowerCase();
    const baseName = path.basename(originalFileName, path.extname(originalFileName));

    console.log(`📦 Uploading font: ${originalFileName} (${ext})`);
    console.log(`📦 Buffer length: ${req.file.buffer.length}`);

    // 1️⃣ Upload original file to S3
    const originalKey = `fonts/${Date.now()}-${originalFileName}`;
    await s3
      .upload({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: originalKey,
        Body: req.file.buffer, // always a Buffer
      })
      .promise();

    const originalUrl = s3.getSignedUrl("getObject", {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: originalKey,
      Expires: 60 * 60, // 1 hour
    });

    // 2️⃣ Try to create WOFF2 version
    let woff2Url = null;
    const woff2Buffer = await ensureWoff2(req.file.buffer, ext);

    if (woff2Buffer) {
      const woff2Key = `fonts/${Date.now()}-${baseName}.woff2`;
      await s3
        .upload({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: woff2Key,
          Body: woff2Buffer,
        })
        .promise();

      woff2Url = s3.getSignedUrl("getObject", {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: woff2Key,
        Expires: 60 * 60,
      });
    } else {
      console.warn(`⚠️ WOFF2 conversion skipped for: ${originalFileName}`);
    }

    // 3️⃣ Save to MongoDB
    const fontDoc = await Font.create({
      name: baseName,
      originalFile: originalKey,
      woff2File: woff2Buffer ? `${baseName}.woff2` : null,
      originalDownloadUrl: originalUrl,
      woff2DownloadUrl: woff2Url,
      user: req.user.id,
    });

    res.status(201).json(fontDoc);
  } catch (err) {
    console.error("❌ Font upload error:", err);
    res.status(500).json({ message: "Font upload failed" });
  }
};

/**
 * 📄 Get all fonts for logged-in user (with S3 preview URLs)
 */
export const getAllFonts = async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const fonts = await Font.find(
      isAdmin ? {} : { user: req.user.id }
    ).sort({ createdAt: -1 });

    // Attach signed preview URL
    const fontsWithPreviews = await Promise.all(
      fonts.map(async (font) => {
        let signedUrl = null;
        try {
          signedUrl = s3.getSignedUrl("getObject", {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: font.originalFile,
            Expires: 3600, // 1 hour
          });
        } catch (err) {
          console.error("⚠️ Failed to generate preview URL:", err);
        }

        return {
          ...font.toObject(),
          previewUrl: signedUrl,
        };
      })
    );

    res.json(fontsWithPreviews);
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

    // Delete from S3
    await s3
      .deleteObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: font.originalFile,
      })
      .promise();

    // Delete from MongoDB
    await Font.deleteOne({ _id: font._id });

    res.json({ message: "Font deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting font:", err);
    res.status(500).json({ message: "Error deleting font" });
  }
};
