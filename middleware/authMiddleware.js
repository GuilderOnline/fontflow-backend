import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Middleware to authenticate JWT token
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  // Check for Bearer token in Authorization header
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    // Extract token and verify using JWT_SECRET
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach decoded user info to request
    next();
  } catch (err) {
    // If token is invalid, send 401 response
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Middleware to authorize user roles
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // Check if user's role is allowed
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};