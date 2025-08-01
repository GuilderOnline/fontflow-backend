// controllers/fontController.js
import AWS from "aws-sdk";
import * as fontkit from "fontkit"; // ✅ FIXED for ESM
import fileType from "file-type";   // ✅ Import entire package (works on Render's Node + file-type v16)
import Font from "../models/fontModel.js";
import { ensureWoff2 } from '../utils/fontConversion.js';
import path from "path";




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

    // Extract metadata before uploading
    const metadata = extractFontMetadata(req.file.buffer);

    // Upload original
    const originalKey = `fonts/${Date.now()}-${originalFileName}`;
    await s3.upload({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: originalKey,
      Body: req.file.buffer,
    }).promise();

    // Convert TTF to WOFF2 if possible
    let woff2Key = null;
    const woff2Buffer = await ensureWoff2(req.file.buffer, ext);
    if (woff2Buffer) {
      woff2Key = `fonts/${Date.now()}-${baseName}.woff2`;
      await s3.upload({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: woff2Key,
        Body: woff2Buffer,
      }).promise();
    }

    // Save in MongoDB (store keys, not signed URLs)
    const fontDoc = await Font.create({
      name: baseName,
      originalFile: originalKey,
      woff2File: woff2Key,
      family: metadata.family,
      fullName: metadata.fullName,
      postscriptName: metadata.postscriptName,
      style: metadata.style,
      weight: metadata.weight,
      manufacturer: metadata.manufacturer,
      license: metadata.license,
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
    const fonts = await Font.find({ user: req.user.id }).sort({ createdAt: -1 });

    const fontsWithUrls = fonts.map((font) => {
      const originalDownloadUrl = font.originalFile
        ? s3.getSignedUrl("getObject", {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: font.originalFile,
            Expires: 60 * 60, // 1 hour each request
          })
        : null;

      const woff2DownloadUrl = font.woff2File
        ? s3.getSignedUrl("getObject", {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: font.woff2File,
            Expires: 60 * 60,
          })
        : null;

      return {
        ...font.toObject(),
        originalDownloadUrl,
        woff2DownloadUrl,
      };
    });

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
