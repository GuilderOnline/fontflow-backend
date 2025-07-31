import fs from "fs";
import path from "path";
import { createRequire } from "module";
import AWS from "aws-sdk";
import mongoose from "mongoose";
import Font from "../models/fontModel.js";

// ✅ Load CommonJS packages correctly
const require = createRequire(import.meta.url);
const fontkit = require("fontkit");
const fileType = require("file-type");

// ✅ AWS S3 setup
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// ======================
// UPLOAD FONT
// ======================
export const uploadFont = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // ✅ Detect file type from buffer
    const typeResult = await fileType.fromBuffer(file.buffer);
    if (!typeResult || !["ttf", "otf", "woff", "woff2", "eot"].includes(typeResult.ext)) {
      return res.status(400).json({ message: "Unsupported font format" });
    }

    // ✅ Extract font metadata from buffer
    const font = fontkit.openSync(file.buffer);

    // ✅ Upload to S3
    const s3Key = `${Date.now()}-${file.originalname}`;
    await s3
      .upload({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
      .promise();

    // ✅ Save font metadata to MongoDB
    const newFont = await Font.create({
      name: file.originalname,
      originalFile: s3Key,
      family: font.familyName,
      fullName: font.fullName,
      postscriptName: font.postscriptName,
      style: font.subfamilyName,
      weight: font["OS/2"]?.usWeightClass || null,
      manufacturer: font.manufacturer || null,
      license: font.license || null,
      user: req.user.id,
    });

    res.status(201).json({
      message: "Font uploaded successfully",
      font: newFont,
    });
  } catch (error) {
    console.error("❌ Error uploading font:", error);
    res.status(500).json({ message: error.message });
  }
};

// ======================
// DELETE FONT
// ======================
export const deleteFont = async (req, res) => {
  try {
    const font = await Font.findById(req.params.id);
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

    // Delete from DB
    await font.deleteOne();

    res.json({ message: "Font deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting font:", error);
    res.status(500).json({ message: error.message });
  }
};

// ======================
// GET ALL FONTS
// ======================
export const getAllFonts = async (req, res) => {
  try {
    const fonts = await Font.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(fonts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
