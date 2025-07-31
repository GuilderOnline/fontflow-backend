// controllers/fontController.js
import AWS from "aws-sdk";
import * as fontkit from "fontkit"; // ✅ FIXED for ESM
import fileType from "file-type";   // ✅ Import entire package (works on Render's Node + file-type v16)
import ttf2woff2 from "ttf2woff2";
import otf2ttf from "otf2ttf";
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


/**
 * 📤 Upload and process font
 */
export const uploadFont = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'No font file uploaded' });
    }

    // Detect type
    const type = await fileTypeFromBuffer(req.file.buffer);
    if (!type || !['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(type.ext)) {
      return res.status(400).json({ message: 'Unsupported font format' });
    }

    // Generate unique filenames
    const timestamp = Date.now();
    const originalKey = `${timestamp}-${req.file.originalname}`;
    const woff2Key = originalKey.replace(/\.(ttf|otf)$/i, '.woff2');

    // Upload original font
    await s3.putObject({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: originalKey,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }).promise();

    // Convert to WOFF2 if TTF/OTF
    if (type.ext === 'ttf' || type.ext === 'otf') {
      const woff2Buffer = ttf2woff2(req.file.buffer);

      await s3.putObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: woff2Key,
        Body: woff2Buffer,
        ContentType: 'font/woff2',
      }).promise();
    }

    // Extract metadata
    const font = fontkit.create(req.file.buffer);
    const metadata = {
      family: font.familyName,
      fullName: font.fullName,
      postscriptName: font.postscriptName,
      style: font.subfamilyName,
      weight: font['OS/2']?.usWeightClass || '',
      manufacturer: font.manufacturer || '',
      license: font.license || '',
    };

    // Save in MongoDB
    const newFont = await Font.create({
      name: req.file.originalname,
      originalFile: originalKey,
      woff2File: (type.ext === 'ttf' || type.ext === 'otf') ? woff2Key : null,
      user: req.user.id,
      ...metadata,
    });

    // Create signed URLs
    const originalUrl = s3.getSignedUrl('getObject', {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: originalKey,
      Expires: 300,
    });

    const woff2Url = newFont.woff2File
      ? s3.getSignedUrl('getObject', {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: newFont.woff2File,
          Expires: 300,
        })
      : null;

    res.json({
      ...newFont.toObject(),
      originalDownloadUrl: originalUrl,
      woff2DownloadUrl: woff2Url,
    });

  } catch (err) {
    console.error('❌ Font upload error:', err);
    res.status(500).json({ message: 'Error uploading font' });
  }
};
/**
 * 📄 Get all fonts for logged-in user
 */
export const getAllFonts = async (req, res) => {
  try {
    // Admins see all fonts, normal users only their own
    const query = req.user.role === "admin" ? {} : { user: req.user.id };
    const fonts = await Font.find(query).sort({ createdAt: -1 });

    // Attach fresh signed URLs
    const fontsWithUrls = fonts.map(font => {
      const originalUrl = font.originalFile
        ? s3.getSignedUrl("getObject", {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: font.originalFile,
            Expires: 60 * 5 // 5 min expiry
          })
        : null;

      const woff2Url = font.woff2File
        ? s3.getSignedUrl("getObject", {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: font.woff2File,
            Expires: 60 * 5
          })
        : null;

      return {
        ...font.toObject(),
        originalDownloadUrl: originalUrl,
        woff2DownloadUrl: woff2Url
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
