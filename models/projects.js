import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },                         // e.g., "My Website"
  slug: { type: String, unique: true },                           // e.g., "my-website"
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fonts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Font' }], // Fonts linked to this project
  createdAt: { type: Date, default: Date.now },

  // Optional fields for future:
  notes: { type: String },
  tags: [{ type: String }],                                       // e.g., ["client", "brand"]
});

const Project = mongoose.model('Project', projectSchema);
export default Project;
