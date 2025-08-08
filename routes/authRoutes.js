import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/userModel.js';

dotenv.config(); // Load environment variables

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Look up user by email
    const user = await User.findOne({ email });

    if (!user) {
      // If user not found, send 401 response
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Compare password using bcrypt
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // If password does not match, send 401 response
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Create JWT token with user id and role
    const token = jwt.sign(
      { id: user._id, role: user.role },  // use "id"
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    console.log('JWT payload:', { id: user._id, role: user.role });
    console.log('JWT token:', token);

    // Success: send token and user info
    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });

  } catch (err) {
    // Log error and send server error response
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

export default router;