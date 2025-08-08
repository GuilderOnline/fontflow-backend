// Font model definition using Mongoose
import mongoose from 'mongoose';

// Define schema for font documents
const fontSchema = new mongoose.Schema({
  fullName: String,                          // Font full name
  style: String,                             // Font style (e.g., Regular, Italic)
  weight: String,                            // Font weight (e.g., 400, Bold)
  description: String,                       // Description of the font
  manufacturer: String,                      // Font manufacturer or foundry
  license: String,                           // License type or info
  originalFile: String,                      // S3 key for original font file
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },      // Reference to uploading user
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' }, // Reference to associated project
  createdAt: { type: Date, default: Date.now }, // Timestamp of upload
  // Optional extras for mobile or offline use:
  ttfUrl: { type: String },                  // S3 URL to .ttf for native app use
  otfUrl: { type: String },                  // Optional fallback or alternative format
  bundleUrl: { type: String },               // Optional ZIP for offline use
  tags: [{ type: String }],                  // Tags for categorization (e.g., ["web", "ios", "android"])
});

// Prevent OverwriteModelError in dev mode (e.g. Vite or Nodemon hot reload)
const Font = mongoose.models.Font || mongoose.model('Font', fontSchema);

export default Font;