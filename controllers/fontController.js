import { createRequire } from "module";
const require = createRequire(import.meta.url);

// CommonJS modules
const fileType = require("file-type");
import AWS from "aws-sdk";
import mongoose from "mongoose";
import Font from "../models/fontModel.js";
import fontkit from "fontkit"; // ES import works for named exports

// Multer config - Memory storage
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

// AWS S3 Config
const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

/**
 * Upload font
 */
export const uploadFont = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    // Detect file type
    const detectedType = await fileType.fileTypeFromBuffer(file.buffer);
    if (!detectedType || !["ttf", "otf", "woff", "woff2", "eot"].includes(detectedType.ext)) {
      return res.status(400).json({ message: "Unsupported font type" });
    }

    // ✅ Parse font metadata from Buffer
    let fontMeta;
    try {
      const font = fontkit.create(file.buffer);
      fontMeta = {
        family: font.familyName || "",
        fullName: font.fullName || "",
        postscriptName: font.postscriptName || "",
        style: font.subfamilyName || "",
        weight: font["OS/2"]?.usWeightClass || "",
        manufacturer: font.manufacturer || "",
      };
    } catch (err) {
      console.error("❌ Could not parse font buffer:", err);
      return res.status(400).json({ message: "Invalid font file" });
    }

    // S3 Key
    const s3Key = `${Date.now()}-${file.originalname}`;

    // Upload to S3
    await s3
      .putObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype
      })
      .promise();

    // Save to MongoDB
    const fontDoc = await Font.create({
      name: file.originalname,
      originalFile: s3Key,
      user: req.user.id,
      ...fontMeta
    });

    res.status(200).json({
      message: "Font uploaded successfully",
      font: fontDoc
    });

  } catch (err) {
    console.error("❌ Error uploading font:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get all fonts
 */
export const getAllFonts = async (req, res) => {
  try {
    const fonts = await Font.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(fonts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Delete font
 */
export const deleteFont = async (req, res) => {
  try {
    const font = await Font.findOne({ _id: req.params.id, user: req.user.id });
    if (!font) return res.status(404).json({ message: "Font not found" });

    // Remove from S3
    await s3
      .deleteObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: font.originalFile
      })
      .promise();

    // Remove from DB
    await Font.deleteOne({ _id: req.params.id });

    res.status(200).json({ message: "Font deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Multer middleware for routes
export const uploadMiddleware = upload.single("font");
