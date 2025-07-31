// controllers/fontController.js
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// ✅ Works with file-type@16.5.4 CommonJS build on Render
const fileTypeFromBuffer = require("file-type");

import fs from "fs";
import path from "path";
import AWS from "aws-sdk";
import multer from "multer";
import Font from "../models/fontModel.js";
import mongoose from "mongoose";

// Setup AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Multer storage (store locally before upload to S3)
const upload = multer({ dest: "uploads/" });

// Upload font to S3
export const uploadFont = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);

    // ✅ Works on Render now
    const type = await fileTypeFromBuffer(buffer);
    if (!type || !["ttf", "otf", "woff", "woff2"].includes(type.ext)) {
      fs.unlinkSync(filePath); // cleanup
      return res.status(400).json({ error: "Invalid font file type" });
    }

    // Upload to S3
    const s3Key = `${Date.now()}-${req.file.originalname}`;
    await s3
      .upload({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: buffer,
        ContentType: type.mime,
      })
      .promise();

    // Save in DB
    const font = await Font.create({
      name: req.file.originalname,
      originalFile: s3Key,
      user: req.user.id,
    });

    // Cleanup temp file
    fs.unlinkSync(filePath);

    res.json({ message: "Font uploaded successfully", font });
  } catch (err) {
    console.error("❌ Error uploading font:", err);
    res.status(500).json({ error: "Error uploading font" });
  }
};

// Get all fonts for logged-in user
export const getAllFonts = async (req, res) => {
  try {
    const fonts = await Font.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(fonts);
  } catch (err) {
    res.status(500).json({ error: "Error fetching fonts" });
  }
};

// Delete font
export const deleteFont = async (req, res) => {
  try {
    const font = await Font.findOne({ _id: req.params.id, user: req.user.id });
    if (!font) {
      return res.status(404).json({ error: "Font not found" });
    }

    // Delete from S3
    await s3
      .deleteObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: font.originalFile,
      })
      .promise();

    await Font.deleteOne({ _id: req.params.id });

    res.json({ message: "Font deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting font" });
  }
};

// Multer middleware for routes
export const multerUpload = upload.single("font");
