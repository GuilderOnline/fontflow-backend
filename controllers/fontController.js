// controllers/fontController.js
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fontkit = require("fontkit"); // ✅ CommonJS require for fontkit
import { fileTypeFromBuffer } from "file-type"; // ✅ ESM-safe import
import AWS from "aws-sdk";
import Font from "../models/fontModel.js";

// ✅ AWS S3 config
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
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const buffer = req.file.buffer;

    // ✅ Detect file type
    const type = await fileTypeFromBuffer(buffer);
    if (
      !type ||
      !["font/ttf", "font/otf", "application/font-woff", "application/font-woff2"].includes(type.mime)
    ) {
      return res.status(400).json({ message: "Invalid font file" });
    }

    // ✅ Read metadata from buffer using fontkit
    const font = fontkit.create(buffer);
    const metadata = {
      family: font.familyName || "",
      fullName: font.fullName || "",
      postscriptName: font.postscriptName || "",
      style: font.subfamilyName || "",
    };

    // ✅ Upload to S3
    const s3Key = `${Date.now()}-${req.file.originalname}`;
    await s3
      .putObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: buffer,
        ContentType: type.mime,
      })
      .promise();

    // ✅ Save to MongoDB
    const savedFont = await Font.create({
      user: req.user.id,
      originalFile: s3Key,
      ...metadata,
    });

    res.json({
      message: "Font uploaded successfully",
      font: savedFont,
    });
  } catch (err) {
    console.error("❌ Error uploading font:", err);
    res.status(500).json({ message: "Error uploading font" });
  }
};

/**
 * 📄 Get all fonts for the logged-in user
 */
export const getAllFonts = async (req, res) => {
  try {
    const fonts = await Font.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(fonts);
  } catch (err) {
    console.error("❌ Error fetching fonts:", err);
    res.status(500).json({ message: "Error fetching fonts" });
  }
};

/**
 * 🗑️ Delete a font
 */
export const deleteFont = async (req, res) => {
  try {
    const font = await Font.findById(req.params.id);

    if (!font) {
      return res.status(404).json({ message: "Font not found" });
    }

    // ✅ Delete from S3
    await s3
      .deleteObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: font.originalFile,
      })
      .promise();

    // ✅ Delete from MongoDB
    await Font.findByIdAndDelete(req.params.id);

    res.json({ message: "Font deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting font:", err);
    res.status(500).json({ message: "Error deleting font" });
  }
};
