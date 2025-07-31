// controllers/fontController.js
import pkg from "file-type"; // CommonJS compat for file-type
const { fileTypeFromBuffer } = pkg;

import fontkitPkg from "fontkit"; // CommonJS compat for fontkit
const fontkit = fontkitPkg;

import Font from "../models/fontModel.js";
import AWS from "aws-sdk";

// Configure S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

/**
 * Upload font
 */
export const uploadFont = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Detect file type
    const type = await fileTypeFromBuffer(file.buffer);
    if (!type || !["otf", "ttf", "woff", "woff2"].includes(type.ext)) {
      return res.status(400).json({ message: "Invalid font file" });
    }

    // Extract font metadata
    const fontData = fontkit.create(file.buffer);
    const fontName = fontData.fullName || fontData.familyName || file.originalname;

    // Upload to S3
    const s3Key = `${Date.now()}-${file.originalname}`;
    await s3
      .upload({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype
      })
      .promise();

    // Save to MongoDB
    const newFont = new Font({
      name: fontName,
      originalFile: s3Key,
      user: req.user.id, // from auth middleware
      family: fontData.familyName,
      fullName: fontData.fullName,
      postscriptName: fontData.postscriptName,
      style: fontData.subfamilyName,
      weight: fontData.weight || "",
      manufacturer: fontData.manufacturer || "",
      license: fontData.license || ""
    });

    await newFont.save();

    res.json({
      message: "Font uploaded successfully",
      font: newFont
    });
  } catch (err) {
    console.error("❌ Error uploading font:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get all fonts (admin or user filtered)
 */
export const getAllFonts = async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { user: req.user.id };
    const fonts = await Font.find(filter).sort({ createdAt: -1 });
    res.json(fonts);
  } catch (err) {
    console.error("❌ Error fetching fonts:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Delete font
 */
export const deleteFont = async (req, res) => {
  try {
    const font = await Font.findById(req.params.id);
    if (!font) {
      return res.status(404).json({ message: "Font not found" });
    }

    // Only allow admin or owner to delete
    if (req.user.role !== "admin" && font.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Delete from S3
    await s3
      .deleteObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: font.originalFile
      })
      .promise();

    // Delete from MongoDB
    await font.deleteOne();

    res.json({ message: "Font deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting font:", err);
    res.status(500).json({ message: "Server error" });
  }
};
