// controllers/fontController.js
import fs from "fs";
import path from "path";
import AWS from "aws-sdk";
import Font from "../models/fontModel.js";

// ✅ Allow CommonJS require in ESM
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// ✅ fontkit is CommonJS-only, so require it
const fontkit = require("fontkit");

// ✅ file-type is pure ESM, so import directly
import { fileTypeFromBuffer } from "file-type";

// ✅ Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "eu-west-1",
});

// 📤 UPLOAD FONT
export const uploadFont = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No font file uploaded" });
    }

    // ✅ Detect file type from buffer
    const fileType = await fileTypeFromBuffer(req.file.buffer);
    if (!fileType || !["ttf", "otf", "woff", "woff2", "eot"].includes(fileType.ext)) {
      return res.status(400).json({ message: "Invalid font file type" });
    }

    // ✅ Parse font metadata
    const font = fontkit.create(req.file.buffer);
    const fontMetadata = {
      family: font.familyName,
      fullName: font.fullName,
      postscriptName: font.postscriptName,
      style: font.subfamilyName,
      weight: font["OS/2"]?.usWeightClass || null,
      manufacturer: font.manufacturer || "",
    };

    // ✅ Prepare S3 upload
    const s3Key = `${Date.now()}-${req.file.originalname}`;

    await s3
      .upload({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
      .promise();

    // ✅ Save to MongoDB
    const newFont = new Font({
      name: req.file.originalname,
      originalFile: s3Key,
      user: req.user.id, // from JWT auth
      ...fontMetadata,
    });

    await newFont.save();

    res.status(201).json({
      message: "Font uploaded successfully",
      font: newFont,
    });
  } catch (err) {
    console.error("❌ Error uploading font:", err);
    res.status(500).json({ message: "Error uploading font" });
  }
};

// 📄 GET ALL FONTS
export const getAllFonts = async (req, res) => {
  try {
    const fonts = await Font.find().sort({ createdAt: -1 });
    res.status(200).json(fonts);
  } catch (err) {
    console.error("❌ Error fetching fonts:", err);
    res.status(500).json({ message: "Error fetching fonts" });
  }
};

// 🗑️ DELETE FONT
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
    await font.deleteOne();

    res.status(200).json({ message: "Font deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting font:", err);
    res.status(500).json({ message: "Error deleting font" });
  }
};
