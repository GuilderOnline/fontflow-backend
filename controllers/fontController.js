import { createRequire } from "module";
const require = createRequire(import.meta.url);

// ✅ Load CommonJS packages correctly
const fontkit = require("fontkit");
const fileType = require("file-type");
const { fileTypeFromBuffer } = fileType;

import fs from "fs";
import path from "path";
import Font from "../models/fontModel.js";

// ===============================
// 📌 Upload a Font
// ===============================
export const uploadFont = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // ✅ Read file buffer
    const fileBuffer = fs.readFileSync(file.path);

    // ✅ Detect file type
    const detectedType = await fileTypeFromBuffer(fileBuffer);
    if (!detectedType) {
      return res.status(400).json({ message: "Unable to detect file type" });
    }

    const allowedTypes = [
      "font/ttf",
      "font/otf",
      "application/vnd.ms-fontobject",
      "font/woff",
      "font/woff2"
    ];

    if (!allowedTypes.includes(detectedType.mime)) {
      return res.status(400).json({ message: "Invalid font format" });
    }

    // ✅ Extract font metadata using fontkit
    const font = fontkit.openSync(file.path);
    const metadata = {
      family: font.familyName || "",
      fullName: font.fullName || "",
      postscriptName: font.postscriptName || "",
      style: font.subfamilyName || "",
      weight: font.weight || "",
      manufacturer: font.manufacturer || "",
    };

    // ✅ Save to MongoDB
    const newFont = await Font.create({
      name: file.originalname,
      originalFile: file.filename,
      user: req.user._id,
      ...metadata
    });

    res.status(201).json({
      message: "Font uploaded successfully",
      font: newFont
    });

  } catch (err) {
    console.error("❌ Error uploading font:", err);
    res.status(500).json({ message: err.message });
  }
};

// ===============================
// 📌 Get All Fonts
// ===============================
export const getAllFonts = async (req, res) => {
  try {
    const fonts = await Font.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(fonts);
  } catch (err) {
    console.error("❌ Error fetching fonts:", err);
    res.status(500).json({ message: err.message });
  }
};

// ===============================
// 📌 Delete a Font
// ===============================
export const deleteFont = async (req, res) => {
  try {
    const font = await Font.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!font) {
      return res.status(404).json({ message: "Font not found" });
    }

    // Optionally remove from uploads folder
    const filePath = path.join("uploads", font.originalFile);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: "Font deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting font:", err);
    res.status(500).json({ message: err.message });
  }
};
