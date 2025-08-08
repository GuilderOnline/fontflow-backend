import mongoose from 'mongoose';

// Define schema for project documents
const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },                  // Project name
  url: { type: String },                                   // Project URL (optional)
  description: { type: String },                           // Project description (optional)
  slug: { type: String, unique: true },                    // Unique slug for project
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to owner user
  fonts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Font' }], // Fonts linked to this project
  createdAt: { type: Date, default: Date.now },            // Timestamp of creation

  // Optional fields for future:
  notes: { type: String },                                 // Additional notes
  tags: [{ type: String }],                                // Tags for categorization (e.g., ["client", "brand"])
});

// Prevent OverwriteModelError in dev mode is not needed here (single model export)
const Project = mongoose.model('Project', projectSchema);

export default Project;