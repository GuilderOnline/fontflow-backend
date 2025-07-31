// controllers/fontController.js
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// CommonJS imports
const fileType = require("file-type");
const fontkit = require("fontkit");

// AWS S3 & Multer
import multer from "multer";
import multerS3 from "multer-s3";
import AWS from "aws-sdk";

// MongoDB Model
import Font from "../models/fontModel.js";

// AWS S3 Config
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Multer-S3 setup for uploads
const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.S3_BUCKET_NAME,
    acl: "public-read",
    key: function (req, file, cb) {
      const fileName = `${Date.now()}-${file.originalname}`;
      cb(null, fileName);
    },
  }),
});

// Export the multer middleware
export const uploadMiddleware = upload.single("font");

// Detect file type from buffer
const fileTypeFromBuffer = fileType.fileTypeFromBuffer;

// Upload font
export const uploadFont = async (req, res) => {
  try {
    const file = req.file;
    if (!file) throw new Error("No file uploaded");

    // Get buffer from S3 or multer
    let buffer;
    if (file.buffer) {
      buffer = file.buffer;
    } else if (file.location) {
      // Fetch from S3 if only location is available
      const s3Obj = await s3.getObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: file.key,
      }).promise();
      buffer = s3Obj.Body;
    }

    // Detect type
    const type = await fileTypeFromBuffer(buffer);
    if (!type || !["font/ttf", "font/otf", "application/font-sfnt"].includes(type.mime)) {
      throw new Error("Unsupported font type");
    }

    // Extract font metadata
    const font = fontkit.openSync(buffer);
    const fontData = {
      family: font.familyName,
      fullName: font.fullName,
      postscriptName: font.postscriptName,
      style: font.subfamilyName,
      weight: font.weight || "Normal",
    };

    // Save to MongoDB
    const newFont = await Font.create({
      name: file.originalname,
      originalFile: file.location || file.path,
      user: req.user._id,
      ...fontData,
    });

    res.json({ success: true, font: newFont });
  } catch (err) {
    console.error("❌ Error uploading font:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get all fonts for logged-in user
export const getAllFonts = async (req, res) => {
  try {
    const fonts = await Font.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(fonts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete font
export const deleteFont = async (req, res) => {
  try {
    const font = await Font.findOne({ _id: req.params.id, user: req.user._id });
    if (!font) {
      return res.status(404).json({ error: "Font not found" });
    }

    // Delete from S3
    const key = font.originalFile.split("/").pop();
    await s3.deleteObject({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    }).promise();

    // Delete from MongoDB
    await font.deleteOne();

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error deleting font:", err);
    res.status(500).json({ error: err.message });
  }
};
