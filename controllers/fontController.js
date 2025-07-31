// controllers/fontController.js

import pkg from "file-type"; // CommonJS compat for file-type
const { fileTypeFromBuffer } = pkg;

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fontkit = require("fontkit"); // Load CommonJS module in ESM

import AWS from "aws-sdk";
import Font from "../models/fontModel.js";

// AWS S3 Config
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// =======================
// UPLOAD FONT
// =======================
export const uploadFont = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    // Detect file type
    const type = await fileTypeFromBuffer(file.buffer);
    if (!type || !["otf", "ttf", "woff", "woff2"].includes(type.ext)) {
      return res.status(400).json({ error: "Unsupported font format" });
    }

    // Parse font metadata
    const font = fontkit.create(file.buffer);
    const metadata = {
      family: font.familyName || "",
      fullName: font.fullName || "",
      postscriptName: font.postscriptName || "",
      style: font.subfamilyName || "",
      weight: font["OS/2"]?.usWeightClass || "",
      manufacturer: font.manufacturer || "",
      description: font.description || "",
    };

    // Upload to S3
    const s3Key = `${Date.now()}-${file.originalname}`;
    await s3
      .putObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype
      })
      .promise();

    // Save in MongoDB
    const newFont = await Font.create({
      name: file.originalname,
      originalFile: s3Key,
      user: req.user?.id || null,
      ...metadata
    });

    res.json({ message: "Font uploaded successfully", font: newFont });
  } catch (err) {
    console.error("❌ Error uploading font:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// =======================
// GET ALL FONTS
// =======================
export const getAllFonts = async (req, res) => {
  try {
    const fonts = await Font.find({ user: req.user?.id || null }).sort({ createdAt: -1 });
    res.json(fonts);
  } catch (err) {
    console.error("❌ Error fetching fonts:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// =======================
// DELETE FONT
// =======================
export const deleteFont = async (req, res) => {
  try {
    const font = await Font.findById(req.params.id);
    if (!font) return res.status(404).json({ error: "Font not found" });

    // Delete from S3
    await s3
      .deleteObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: font.originalFile
      })
      .promise();

    // Delete from DB
    await font.deleteOne();

    res.json({ message: "Font deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting font:", err);
    res.status(500).json({ error: "Server error" });
  }
};
