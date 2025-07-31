// controllers/fontController.js
import AWS from "aws-sdk";
import * as fontkit from "fontkit"; // ✅ FIXED for ESMimport pkg from "file-type"; // works with ESM
const { fileTypeFromBuffer } = pkg;
import Font from "../models/fontModel.js";

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

    // 1️⃣ Detect file type
    const type = await fileTypeFromBuffer(req.file.buffer);
    if (!type || !["ttf", "otf", "woff", "woff2", "eot"].includes(type.ext)) {
      return res.status(400).json({ message: "Invalid font format" });
    }

    // 2️⃣ Parse font metadata from memory
    let font;
    try {
      font = fontkit.create(req.file.buffer);
    } catch (err) {
      console.error("❌ Font parsing error:", err);
      return res.status(400).json({ message: "Unable to parse font file" });
    }

    const fontMetadata = {
      family: font.familyName || "",
      fullName: font.fullName || "",
      postscriptName: font.postscriptName || "",
      style: font.subfamilyName || "",
      weight: font["OS/2"]?.usWeightClass || null,
      manufacturer: font.manufacturer || "",
    };

    // 3️⃣ Upload to S3
    const s3Key = `${Date.now()}-${req.file.originalname}`;
    await s3
      .putObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: type.mime,
      })
      .promise();

    // 4️⃣ Save metadata to MongoDB
    const newFont = new Font({
      name: req.file.originalname,
      originalFile: s3Key,
      user: req.user.id,
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

/**
 * 📄 Get all fonts for logged-in user
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
