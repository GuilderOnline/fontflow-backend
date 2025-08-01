// controllers/fontController.js
import AWS from "aws-sdk";
import * as fontkit from "fontkit"; // ✅ FIXED for ESM
import fileType from "file-type";   // ✅ Import entire package (works on Render's Node + file-type v16)
import Font from "../models/fontModel.js";
import { ensureWoff2 } from '../utils/fontConversion.js';
import path from "path";




// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

function extractFontMetadata(buffer) {
  try {
    const font = fontkit.create(buffer);
    return {
      family: font.familyName || "",
      fullName: font.fullName || "",
      postscriptName: font.postscriptName || "",
      style: font.subfamilyName || "",
      weight: font["OS/2"]?.usWeightClass || "",
      manufacturer: font.manufacturer || "",
      license: font.license || "",
    };
  } catch (err) {
    console.warn("⚠️ Could not extract font metadata:", err);
    return {};
  }
}


/**
 * 📤 Upload a font
 */
export const uploadFont = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "No font file uploaded" });
    }

    // Detect file type
    const type = await fileType.fromBuffer(req.file.buffer);
    if (!type) return res.status(400).json({ message: "Unsupported file type" });

    const ext = type.ext.toLowerCase();
    const fileNameBase = `${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;
    const originalKey = `fonts/${fileNameBase}`;
    
    // Upload original font to S3 with public-read
    await s3
      .upload({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: originalKey,
        Body: req.file.buffer,
        ContentType: type.mime,
        // ACL: "public-read",
      })
      .promise();

    // Convert to WOFF2
    const woff2Buffer = await ensureWoff2(req.file.buffer, ext);
    let woff2Key = null;

    if (woff2Buffer) {
      woff2Key = `fonts/${fileNameBase.replace(/\.[^/.]+$/, "")}.woff2`;
      await s3
        .upload({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: woff2Key,
          Body: woff2Buffer,
          ContentType: "font/woff2",
          // ACL: "public-read",
        })
        .promise();
    }

    // Public URLs (never expire)
    const bucket = process.env.S3_BUCKET_NAME;
    const region = process.env.AWS_REGION;

    const originalUrl = `https://${bucket}.s3.${region}.amazonaws.com/${originalKey}`;
    const woff2Url = woff2Key
      ? `https://${bucket}.s3.${region}.amazonaws.com/${woff2Key}`
      : null;

    // Extract font metadata
    const fontMetadata = await extractFontMetadata(req.file.buffer);

    // Save to MongoDB
    const fontDoc = new Font({
      name: fontMetadata.fullName,
      family: fontMetadata.family,
      style: fontMetadata.style,
      weight: fontMetadata.weight,
      description: fontMetadata.description || "",
      license: fontMetadata.license || "",
      manufacturer: fontMetadata.manufacturer || "",
      originalFile: originalUrl,
      woff2File: woff2Url,
      user: req.user.id,
    });

    await fontDoc.save();

    res.status(201).json({ message: "Font uploaded successfully", font: fontDoc });

  } catch (err) {
    console.error("❌ Font upload error:", err);
    res.status(500).json({ message: err.message || "Error uploading font" });
  }
};



/**
 * 📄 Get all fonts for logged-in user (with S3 preview URLs)
 */
export const getAllFonts = async (req, res) => {
  try {
    // Fetch all fonts for the logged-in user
    const fonts = await Font.find({ user: req.user.id }).sort({ createdAt: -1 });

    // Map through fonts and attach permanent URLs
    const fontsWithUrls = fonts.map((font) => {
      const originalDownloadUrl = font.originalFile
        ? `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${font.originalFile}`
        : null;

      const woff2DownloadUrl = font.woff2File
        ? `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${font.woff2File}`
        : null;

      return {
        ...font.toObject(),
        originalDownloadUrl,
        woff2DownloadUrl,
      };
    });

    res.status(200).json(fontsWithUrls);
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
