import AWS from "aws-sdk";
import fontkit from "fontkit";
import fileType from "file-type";
import Font from "../models/fontModel.js";

// ✅ Correctly destructure from CommonJS export
const { fileTypeFromBuffer } = fileType;

// Configure S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// ---------- UPLOAD FONT ----------
export const uploadFont = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "No font file uploaded" });
    }

    console.log("📂 Incoming file object:", {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      encoding: req.file.encoding,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // Detect file type from buffer
    const detectedType = await fileTypeFromBuffer(req.file.buffer);
    if (!detectedType) {
      return res.status(400).json({ message: "Could not detect file type" });
    }

    console.log("📄 Detected file type:", detectedType);

    // Extract metadata from font
    const font = fontkit.create(req.file.buffer);
    const metadata = {
      family: font.familyName,
      fullName: font.fullName,
      postscriptName: font.postscriptName,
      style: font.subfamilyName,
      weight: font.weight || null,
      manufacturer: font.manufacturer || null,
      description: font.description || null,
    };

    console.log("📝 Extracted metadata:", metadata);

    // Upload to S3
    const s3Key = `${Date.now()}-${req.file.originalname}`;
    await s3
      .putObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: detectedType.mime,
      })
      .promise();

    console.log(`✅ Uploaded to S3: ${s3Key}`);

    // Save to MongoDB
    const newFont = new Font({
      name: req.file.originalname,
      originalFile: s3Key,
      user: req.user?.id || null, // If using auth middleware
      ...metadata,
    });

    await newFont.save();

    res.json({
      message: "Font uploaded successfully",
      font: newFont,
    });
  } catch (error) {
    console.error("❌ Error uploading font:", error);
    res.status(500).json({ message: "Error uploading font" });
  }
};
