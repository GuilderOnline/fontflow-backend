import express from 'express';
import multer from 'multer';
import { uploadFont, deleteFont, getAllFonts } from '../controllers/fontController.js';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import Font from '../models/fontModel.js';

const router = express.Router();

// Route to delete a font by ID (logs request, then authenticates and deletes)
router.delete('/:id', (req, res, next) => {
  console.log("Delete route hit:", req.params.id);
  next();
}, jwtAuth, deleteFont);

// Multer memory storage for in-memory buffer upload
const upload = multer({ storage: multer.memoryStorage() });

// Example admin-only route (protected by role middleware)
router.get('/admin-only', authenticate, authorizeRoles('admin'), (req, res) => {
  res.send('Only admins can see this.');
});
  
// Upload font route (JWT required, uses multer for file upload)
router.post('/upload', jwtAuth, upload.single('font'), uploadFont);

// Get all fonts for logged-in user (JWT required)
router.get('/', jwtAuth, getAllFonts);
 
// Get fonts owned by the logged-in user (JWT required)
router.get('/user', jwtAuth, async (req, res) => {
  try {
    // Find fonts by user ID and sort by creation date
    const fonts = await Font.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(fonts);
  } catch (err) {
    console.error('Error fetching user fonts:', err);
    res.status(500).json({ message: 'Error fetching user fonts' });
  }
  // Delete a font by ID (JWT required)
  router.delete('/:id', jwtAuth, deleteFont);
});

export default router;