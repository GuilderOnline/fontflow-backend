// models/APIKey.js
import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema({
  key: { type: String, required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  createdAt: { type: Date, default: Date.now },
});

// Prevent model overwrite errors during dev
const ApiKey = mongoose.models.ApiKey || mongoose.model('ApiKey', apiKeySchema);
export default ApiKey;
