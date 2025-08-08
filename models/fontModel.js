import mongoose from 'mongoose';

// Define schema for font documents
const fontSchema = new mongoose.Schema({
  name: String,                                 // Font name
  originalFile: String,                         // S3 key for original font file
  user: {                                       // Reference to uploading user
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  woff2File: { type: String },                  // S3 key for WOFF2 file
  family: String,                               // Font family name
  fullName: String,                             // Full font name
  postscriptName: String,                       // PostScript name
  style: String,                                // Font style (e.g., Regular, Italic)
  weight: String,                               // Font weight (e.g., 400, Bold)
  copyright: String,                            // Copyright info
  version: String,                              // Font version
  manufacturer: String,                         // Manufacturer or foundry
  designer: String,                             // Designer name
  description: String,                          // Description of the font
  license: String,                              // License type or info
  createdAt: {                                  // Timestamp of upload
    type: Date,
    default: Date.now,
  },
});

// Prevent OverwriteModelError in dev mode (e.g. hot reload)
export default mongoose.models.Font || mongoose.model('Font', fontSchema);