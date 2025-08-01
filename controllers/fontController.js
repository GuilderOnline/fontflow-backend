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

    const buffer = req.file.buffer;
    const ext = req.file.originalname.split(".").pop().toLowerCase();
    const fileNameBase = `${Date.now()}-${req.file.originalname.replace(/\s+/g, "_")}`;

    // Ensure WOFF2 version
    const woff2Buffer = await ensureWoff2(buffer, ext);

    // Upload Original to `fonts/`
    const originalKey = `fonts/${fileNameBase}`;
    await s3.putObject({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: originalKey,
      Body: buffer,
      ContentType: req.file.mimetype
    }).promise();

    // Upload WOFF2 to `fonts/`
    let woff2Key = null;
    if (woff2Buffer) {
      woff2Key = `fonts/${fileNameBase}.woff2`;
      await s3.putObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: woff2Key,
        Body: woff2Buffer,
        ContentType: "font/woff2"
      }).promise();
    }

    // Permanent Public URLs
    const originalUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${originalKey}`;
    const woff2Url = woff2Key
      ? `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${woff2Key}`
      : null;

    // Extract Metadata
    const metadata = extractFontMetadata(buffer);

    // Save to Mongo
    const fontDoc = await Font.create({
      name: req.file.originalname,
      originalFile: originalUrl,
      woff2File: woff2Url,
      user: req.user.id,
      ...metadata
    });

    res.status(201).json(fontDoc);
  } catch (err) {
    console.error("❌ Font upload error:", err);
    res.status(500).json({ message: "Error uploading font" });
  }
};




/**
 * 📄 Get all fonts for logged-in user (with S3 preview URLs)
 */
export const getAllFonts = async (req, res) => {
  try {
    const query = req.user.role === "admin" ? {} : { user: req.user.id };
    const fonts = await Font.find(query).sort({ createdAt: -1 });

    const fontsWithUrls = fonts.map((font) => {
      const fontObj = font.toObject();

      if (font.originalFile) {
        fontObj.originalDownloadUrl = s3.getSignedUrl("getObject", {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: font.originalFile,
          Expires: 60 * 60, // 1 hour
        });
      }

      if (font.woff2File) {
        fontObj.woff2DownloadUrl = s3.getSignedUrl("getObject", {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: font.woff2File,
          Expires: 60 * 60, // 1 hour
        });
      }

      return fontObj;
    });

    res.json(fontsWithUrls);
  } catch (err) {
    console.error("❌ Error fetching fonts:", err);
    res.status(500).json({ message: "Failed to fetch fonts" });
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
