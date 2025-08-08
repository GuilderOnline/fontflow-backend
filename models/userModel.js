import mongoose from 'mongoose';

// Define schema for user documents
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, // Unique username
  password: { type: String, required: true },               // Hashed password
  role: { type: String, enum: ['admin', 'user'], default: 'user' }, // User role (admin or user)
}, { timestamps: true }); // Automatically adds createdAt and updatedAt fields

export default mongoose.model('User', userSchema);