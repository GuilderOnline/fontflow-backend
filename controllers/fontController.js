// controllers/fontController.js
import AWS from 'aws-sdk';
import fontkit from 'fontkit';
import fileType from 'file-type';
import Font from '../models/fontModel.js';
import path from 'path';

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
      return res.status(400).json({ message: 'No font file uploaded' });
    }

    // ✅ Detect file type from buffer
    const type = await fileType.fromBuffer(req.file.buffer);
    if (!type || !['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(type.ext)) {
      return res.status(400).json({ message: 'Invalid font file type' });
    }

    // ✅ Load font metadata
    const font = fontkit.create(req.file.buffer);
    const fontMetadata = {
      family: font.familyName || '',
      fullName: font.fullName || '',
      postscriptName: font.postscriptName || '',
      style: font.subfamilyName || '',
      weight: font['OS/2']?.usWeightClass || '',
      manufacturer: font.manufacturer || '',
    };

    // ✅ Generate unique S3 key
    const originalFileName = `${Date.now()}-${req.file.originalname}`;

    // ✅ Upload to S3
    await s3
      .upload({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: originalFileName,
        Body: req.file.buffer,
        ContentType: type.mime,
      })
      .promise();

    // ✅ Save to MongoDB
    const newFont = await Font.create({
      name: fontMetadata.family,
      originalFile: originalFileName,
      user: req.user.id,
      ...fontMetadata,
    });

    res.status(201).json(newFont);
  } catch (error) {
    console.error('❌ Error uploading font:', error);
    res.status(500).json({ message: 'Server error while uploading font' });
  }
};

/**
 * 📄 Get all fonts (admin gets all, users get only their own)
 */
export const getAllFonts = async (req, res) => {
  try {
    let fonts;
    if (req.user.role === 'admin') {
      fonts = await Font.find().sort({ createdAt: -1 });
    } else {
      fonts = await Font.find({ user: req.user.id }).sort({ createdAt: -1 });
    }
    res.status(200).json(fonts);
  } catch (error) {
    console.error('❌ Error fetching fonts:', error);
    res.status(500).json({ message: 'Server error while fetching fonts' });
  }
};

/**
 * 🗑️ Delete a font by ID
 */
export const deleteFont = async (req, res) => {
  try {
    const font = await Font.findById(req.params.id);
    if (!font) {
      return res.status(404).json({ message: 'Font not found' });
    }

    // ✅ Ensure user owns the font OR is admin
    if (req.user.role !== 'admin' && font.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this font' });
    }

    // ✅ Delete from S3
    await s3
      .deleteObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: font.originalFile,
      })
      .promise();

    // ✅ Delete from MongoDB
    await font.deleteOne();

    res.status(200).json({ message: 'Font deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting font:', error);
    res.status(500).json({ message: 'Server error while deleting font' });
  }
};
