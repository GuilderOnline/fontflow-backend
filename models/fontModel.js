import mongoose from 'mongoose';

const fontSchema = new mongoose.Schema({
  name: String,
  originalFile: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // ⬇️ Metadata fields
  family: String,
  fullName: String,
  postscriptName: String,
  style: String,
  weight: String,
  copyright: String,
  version: String,
  manufacturer: String,
  designer: String,
  description: String,
  license: String,

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Font = mongoose.model('Font', fontSchema);
export default Font;
