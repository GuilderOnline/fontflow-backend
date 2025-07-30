// models/font.js
import mongoose from 'mongoose';

const fontSchema = new mongoose.Schema({
  fullName: String,
  style: String,
  weight: String,
  description: String,
  manufacturer: String,
  license: String,
  originalFile: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  createdAt: { type: Date, default: Date.now },
  // Optional extras for mobile or offline use:
  ttfUrl: { type: String },                         // S3 URL to .ttf for native app use
  otfUrl: { type: String },                         // Optional fallback or alternative format
  bundleUrl: { type: String },                      // Optional ZIP for offline use
  tags: [{ type: String }],                         // e.g., ["web", "ios", "android"]
});

// Prevent OverwriteModelError in dev mode (e.g. Vite or Nodemon hot reload)
const Font = mongoose.models.Font || mongoose.model('Font', fontSchema);
export default Font;
