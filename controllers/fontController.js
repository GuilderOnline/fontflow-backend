// controllers/fontController.js
import pkg from "fontkit";
const fontkit = pkg; // fix for CommonJS in ESM
import multer from "multer";
import multerS3 from "multer-s3";
import AWS from "aws-sdk";
import Font from "../models/fontModel.js";
import fileTypePkg from "file-type";
const { fileTypeFromBuffer } = fileTypePkg;

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Multer S3 storage
const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.S3_BUCKET_NAME,
    key: (req, file, cb) => {
      const filename = `${Date.now()}-${file.originalname}`;
      cb(null, filename);
    }
  })
});

// Upload font controller
export const uploadFont = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Detect file type
    const buffer = file.buffer || null;
    let detectedType = null;

    if (buffer) {
      const type = await fileTypeFromBuffer(buffer);
      detectedType = type ? type.mime : "unknown";
    }

    // Extract font metadata using fontkit
    const font = fontkit.openSync(file.path || file.location); // location for S3
    const metadata = {
      family: font.familyName,
      fullName: font.fullName,
      postscriptName: font.postscriptName,
      style: font.subfamilyName,
      weight: font.weight,
      manufacturer: font.manufacturer,
      license: font.license
    };

    // Save to MongoDB
    const newFont = new Font({
      name: file.originalname,
      originalFile: file.key,
      user: req.user?._id,
      ...metadata
    });

    await newFont.save();

    res.json({ message: "Font uploaded successfully", font: newFont });
  } catch (error) {
    console.error("❌ Error uploading font:", error);
    res.status(500).json({ message: "Error uploading font" });
  }
};

// Get all fonts
export const getAllFonts = async (req, res) => {
  try {
    const fonts = await Font.find({ user: req.user?._id });
    res.json(fonts);
  } catch (error) {
    console.error("❌ Error fetching fonts:", error);
    res.status(500).json({ message: "Error fetching fonts" });
  }
};

// Delete font
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
        Key: font.originalFile
      })
      .promise();

    // Delete from MongoDB
    await Font.findByIdAndDelete(req.params.id);

    res.json({ message: "Font deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting font:", err);
    res.status(500).json({ message: "Server error deleting font" });
  }
};

export { upload };
