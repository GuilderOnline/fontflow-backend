// routes/fontRoutes.js
import express from 'express';
import { uploadFont, deleteFont, getAllFonts } from '../controllers/fontController.js';
import apiKeyAuth from '../middleware/apiKeyAuth.js';
import { jwtAuth } from '../middleware/jwtAuth.js';
import multer from 'multer';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import Font from '../models/fontModel.js';


const router = express.Router(); // ✅ Initialize router before use

const upload = multer({ storage: multer.memoryStorage() });

// 🔐 Admin-only route (protected by JWT and role check)
router.get('/admin-only', authenticate, authorizeRoles('admin'), (req, res) => {
  res.send('Only admins can see this.');
});

// 📤 Upload font (Requires JWT auth)
router.post('/upload', jwtAuth, upload.single('font'), uploadFont);

// 📄 Get all fonts (Requires API key)
router.get('/', jwtAuth, getAllFonts); // ✅ change to JWT auth for logged-in users

// 🗑️ Delete a font (Requires JWT auth)
router.delete('/:id', jwtAuth, deleteFont);

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
