// controllers/fontController.js
import { createRequire } from "module";
import AWS from "aws-sdk";
import Font from "../models/fontModel.js";
import dotenv from "dotenv";
import fontkit from "fontkit";

dotenv.config();
const require = createRequire(import.meta.url);
const fileType = require("file-type"); // CommonJS require
const { fileTypeFromBuffer } = fileType;

// AWS S3 setup
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Upload font
export const uploadFont = async (req, res) => {
  try {
    const file = req.file; // multer-s3 file
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Detect file type
    const type = await fileTypeFromBuffer(file.buffer);
    if (!type || !["ttf", "otf", "woff", "woff2", "eot"].includes(type.ext)) {
      return res.status(400).json({ message: "Invalid font format" });
    }

    // Read font metadata from buffer
    const font = fontkit.create(file.buffer);
    const fontName = font.fullName || file.originalname;

    // Save metadata to MongoDB
    const newFont = await Font.create({
      name: fontName,
      family: font.familyName,
      fullName: font.fullName,
      postscriptName: font.postscriptName,
      style: font.subfamilyName,
      weight: font.weight || null,
      originalFile: file.location, // S3 URL
      user: req.user.id,
    });

    res.status(201).json({
      message: "Font uploaded successfully",
      font: newFont,
    });
  } catch (err) {
    console.error("❌ Error uploading font:", err);
    res.status(500).json({ message: err.message });
  }
};

// Get all fonts (per user)
export const getAllFonts = async (req, res) => {
  try {
    const fonts = await Font.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(fonts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete font
export const deleteFont = async (req, res) => {
  try {
    const font = await Font.findById(req.params.id);
    if (!font) {
      return res.status(404).json({ message: "Font not found" });
    }

    // Delete from S3
    const key = font.originalFile.split("/").pop();
    await s3
      .deleteObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
      })
      .promise();

    // Delete from MongoDB
    await font.deleteOne();

    res.json({ message: "Font deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting font:", err);
    res.status(500).json({ message: err.message });
  }
};
