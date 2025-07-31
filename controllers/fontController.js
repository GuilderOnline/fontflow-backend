// controllers/fontController.js

import fileType from 'file-type';
const { fileTypeFromBuffer } = fileType; // ✅ works for CommonJS default export
import fs from 'fs';
import AWS from 'aws-sdk';
import * as Fontkit from 'fontkit';
import path from 'path';
import Font from '../models/font.js';
import fileTypePkg from 'file-type';

// Handle both modern (v16+) and legacy (v3–v15) versions
const detectFileType = async (buffer) => {
  if (typeof fileTypePkg.fileTypeFromBuffer === 'function') {
    // v16+
    return await fileTypePkg.fileTypeFromBuffer(buffer);
  }
  if (typeof fileTypePkg === 'function') {
    // v3–v7 style
    return await fileTypePkg(buffer);
  }
  if (typeof fileTypePkg.default?.fileTypeFromBuffer === 'function') {
    // Sometimes default export holds the function
    return await fileTypePkg.default.fileTypeFromBuffer(buffer);
  }
  throw new Error('No compatible file-type detection function found');
};

// AWS S3 configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
// Get all fonts
export const getAllFonts = async (req, res) => {
  try {
    // If admin, get all fonts; otherwise, just the user's
    const query = req.user?.role === 'admin' ? {} : { user: req.user.id };

    const fonts = await Font.find(query).sort({ createdAt: -1 });

    // Attach signed S3 preview URLs
    const fontsWithUrls = await Promise.all(
      fonts.map(async (font) => {
        let previewUrl = null;
        if (font.originalFile) {
          previewUrl = s3.getSignedUrl('getObject', {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: font.originalFile,
            Expires: 3600 // 1 hour
          });
        }
        return { ...font.toObject(), previewUrl };
      })
    );

    res.json(fontsWithUrls);
  } catch (error) {
    console.error('Error getting fonts:', error);
    res.status(500).json({ message: 'Error retrieving fonts' });
  }
};

// Upload font file to S3
export const uploadFont = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📂 Incoming file object:', req.file);

    // 🔹 Use buffer directly from multer (no file path on memory storage)
    const buffer = req.file.buffer;

    // Detect file type safely
    const type = await detectFileType(buffer);
    console.log('📄 Detected file type:', type);

    if (!type || !['font/ttf', 'font/otf', 'application/font-sfnt'].includes(type.mime)) {
      return res.status(400).json({ error: 'Invalid font file type' });
    }

    // Continue with S3 upload...
    // (rest of your existing code unchanged)
    
  } catch (err) {
    console.error('❌ Error uploading font:', err);
    res.status(500).json({ error: 'Error uploading font' });
  }
};

// Get fonts for logged-in user
export const getUserFonts = async (req, res) => {
  try {
    const fonts = await Font.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(fonts);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching fonts' });
  }
};

// Delete a font
export const deleteFont = async (req, res) => {
  try {
    const font = await Font.findById(req.params.id);
    if (!font) return res.status(404).json({ error: 'Font not found' });

    await s3
      .deleteObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: font.originalFile,
      })
      .promise();

    await font.deleteOne();
    res.json({ message: 'Font deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting font' });
  }
};
