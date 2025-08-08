import AWS from "aws-sdk";
import * as fontkit from "fontkit"; // FIXED for ESM
import fileType from "file-type";   // Import entire package (works on Render's Node + file-type v16)
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
    console.warn("Could not extract font metadata:", err);
    return {};
  }
}

// Upload a font
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

    // Extract Metadata
    const metadata = extractFontMetadata(buffer);

    // Save keys (not full URLs) in Mongo
    const fontDoc = await Font.create({
      name: req.file.originalname,
      originalFile: originalKey, // store key
      woff2File: woff2Key,       // store key
      user: req.user.id,
      ...metadata
    });

    // Send back doc + immediate preview URLs
    res.status(201).json({
      ...fontDoc.toObject(),
      originalUrl: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${originalKey}`,
      woff2Url: woff2Key
        ? `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${woff2Key}`
        : null
    });

  } catch (err) {
    console.error("Font upload error:", err);
    res.status(500).json({ message: "Error uploading font" });
  }
};
// Get all fonts for logged-in user (with S3 preview URLs)
export const getAllFonts = async (req, res) => {
  try {
    const query = req.user.role === "admin" ? {} : { user: req.user.id };
    const fonts = await Font.find(query).sort({ createdAt: -1 });

    const fontsWithUrls = fonts.map((font) => {
      const fontObj = font.toObject();

      // Helper to extract only the S3 key (strip bucket URL if stored as full URL)
      const getKey = (filePath) => {
        if (!filePath) return null;

        let key = filePath;
        if (key.startsWith("http")) {
          // Remove bucket domain part and decode
          const parts = key.split(".amazonaws.com/");
          if (parts.length > 1) {
            key = decodeURIComponent(parts[1]);
          }
        }
        return key;
      };

      // Generate signed URLs safely
      const originalKey = getKey(font.originalFile);
      if (originalKey) {
        fontObj.originalDownloadUrl = s3.getSignedUrl("getObject", {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: originalKey,
          Expires: 60 * 60, // 1 hour
        });
      }

      const woff2Key = getKey(font.woff2File);
      if (woff2Key) {
        fontObj.woff2DownloadUrl = s3.getSignedUrl("getObject", {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: woff2Key,
          Expires: 60 * 60, // 1 hour
        });
      }

      return fontObj;
    });

    res.json(fontsWithUrls);
  } catch (err) {
    console.error("Error fetching fonts:", err);
    res.status(500).json({ message: "Failed to fetch fonts" });
  }
};
/*
 * Delete a font (no user ownership check)
 */
export const deleteFont = async (req, res) => {
  try {
    // Find font by ID only
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

    // Delete from MongoDB
    await Font.deleteOne({ _id: font._id });

    res.json({ message: "Font deleted successfully" });
  } catch (err) {
    console.error("Error deleting font:", err);
    res.status(500).json({ message: "Error deleting font" });
  }
};

