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
export const uploadFont = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "No font file uploaded" });
    }
    console.log("📦 Multer file object:", req.file);
    console.log("📦 req.file.buffer type:", typeof req.file.buffer);
    console.log("📦 Is Buffer:", Buffer.isBuffer(req.file.buffer));
    console.log("📦 Buffer length:", req.file.buffer?.length);

    const fileExt = req.file.originalname.split(".").pop().toLowerCase();

    // 1️⃣ Convert to WOFF2
    const woff2Buffer = ensureWoff2(req.file.buffer, fileExt);
    if (!woff2Buffer) {
      return res.status(400).json({ message: "WOFF2 conversion failed" });
    }

    // 2️⃣ Upload original font
    const originalKey = `fonts/${Date.now()}-${req.file.originalname}`;
    await s3
      .upload({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: originalKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
      .promise();

    // 3️⃣ Upload WOFF2 version
    const woff2Key = originalKey.replace(/\.(otf|ttf)$/i, ".woff2");
    await s3
      .upload({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: woff2Key,
        Body: woff2Buffer,
        ContentType: "font/woff2",
      })
      .promise();

    // 4️⃣ Save metadata to MongoDB
    const font = await Font.create({
      name: req.file.originalname,
      originalFile: originalKey,
      woff2File: woff2Key,
      user: req.user.id,
    });

    res.status(201).json({
      message: "✅ Font uploaded & converted",
      font,
    });
  } catch (error) {
    console.error("❌ Font upload error:", error);
    res.status(500).json({ message: "Error uploading font" });
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
