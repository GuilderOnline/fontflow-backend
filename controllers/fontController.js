// controllers/fontController.js

import fileType from 'file-type';
const { fileTypeFromBuffer } = fileType; // ✅ Correct for CommonJS package
import AWS from 'aws-sdk';
import * as Fontkit from 'fontkit';
import Font from '../models/font.js';




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
// 📌 Upload font file to S3
export const uploadFont = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // 1️⃣ Detect file type directly from buffer
    const type = await fileTypeFromBuffer(req.file.buffer);

    // 2️⃣ Validate allowed types
    if (!type || !['font/ttf', 'font/otf', 'application/font-sfnt'].includes(type.mime)) {
      return res.status(400).json({ error: 'Invalid font file type' });
    }

    // 3️⃣ Generate S3 key
    const s3Key = `${Date.now()}-${req.file.originalname}`;

    // 4️⃣ Upload buffer directly to S3
    await s3.upload({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: type.mime,
    }).promise();

    // 5️⃣ Extract font metadata directly from buffer
    const font = Fontkit.create(req.file.buffer);
    const metadata = {
      family: font.familyName || '',
      fullName: font.fullName || '',
      style: font.subfamilyName || '',
      weight: font['OS/2']?.usWeightClass || '',
      description: font.name?.description || '',
      manufacturer: font.manufacturer || '',
      license: font.license || '',
    };

    // 6️⃣ Save to DB
    const newFont = await Font.create({
      ...metadata,
      originalFile: s3Key,
      user: req.user.id,
    });

    res.json(newFont);
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
