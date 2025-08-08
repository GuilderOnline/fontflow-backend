import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

// Middleware to authenticate and attach user from JWT
export const jwtAuth = async (req, res, next) => {
  // Allow preflight OPTIONS requests through without JWT check
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  const authHeader = req.headers.authorization;

  // Check for Bearer token in Authorization header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or malformed token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify JWT token using secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user in DB by decoded id
    const user = await User.findById(decoded.id || decoded.userId).select('-password');
    if (!user) {
      // If user not found, send 401 response
      return res.status(401).json({ message: 'User not found' });
    }

    // Attach user info to request object
    req.user = {
      id: user._id.toString(),
      role: user.role
    };

    next(); // Proceed to next middleware/route
  } catch (err) {
    // If token verification fails, send 401 response
    console.error('JWT verification failed:', err.message);
    res.status(401).json({ message: 'Invalid token' });
  }
};