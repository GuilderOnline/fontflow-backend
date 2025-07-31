// routes/fontRoutes.js
import express from 'express';
import multer from 'multer';
import { uploadFont, deleteFont, getAllFonts } from '../controllers/fontController.js';
import { jwtAuth } from '../middleware/jwtAuth.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import Font from '../models/fontModel.js';

const router = express.Router();

// Multer memory storage for in-memory buffer upload
const upload = multer({ storage: multer.memoryStorage() });

// 🔐 Admin-only example route
router.get('/admin-only', authenticate, authorizeRoles('admin'), (req, res) => {
  res.send('Only admins can see this.');
});

// 📤 Upload font (JWT required)
router.post('/upload', jwtAuth, upload.single('font'), uploadFont);

// 📄 Get all fonts for logged-in user
router.get('/', jwtAuth, getAllFonts);

// 🗑️ Delete a font by ID (JWT required)
router.delete('/:id', jwtAuth, deleteFont);

// 📄 Get fonts owned by the logged-in user
router.get('/user', jwtAuth, async (req, res) => {
  try {
    const fonts = await Font.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(fonts);
  } catch (err) {
    console.error('❌ Error fetching user fonts:', err);
    res.status(500).json({ message: 'Error fetching user fonts' });
  }
}); 

export default router;
