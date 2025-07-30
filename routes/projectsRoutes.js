import express from 'express';
import Project from '../models/projects.js';
import Font from '../models/font.js';
import ApiKey from '../models/APIKey.js';
import slugify from 'slugify';
import { jwtAuth } from '../middleware/jwtAuth.js';

const router = express.Router();

// ✅ GET /api/projects (secured)
router.get('/', jwtAuth, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id }).populate('fonts');
    res.json(projects);
  } catch (err) {
    console.error('❌ Error fetching projects:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ GET /api/projects/:slug
router.get('/:slug', jwtAuth, async (req, res) => {
  try {
    const project = await Project.findOne({ slug: req.params.slug, userId: req.user.id }).populate('fonts');
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ GET /api/projects/:id/apikeys
router.get('/:id/apikeys', jwtAuth, async (req, res) => {
  try {
    const keys = await ApiKey.find({ projectId: req.params.id, userId: req.user.id });
    res.json(keys);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// ✅ POST /api/projects – Create new project
router.post('/', jwtAuth, async (req, res) => {
  try {
    console.log('📥 Incoming body:', req.body);
    console.log('🧠 req.user:', req.user); // ✅ Add this line to inspect the authenticated user

    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name is required' });

    const slug = slugify(name, { lower: true, strict: true });

    const project = new Project({
      name,
      slug,
      userId: req.user.id,
      fonts: [],
    });

    const saved = await project.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('❌ Error in POST /api/projects:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ POST /api/projects/:id/fonts – Add font to project
router.post('/:id/fonts', jwtAuth, async (req, res) => {
  try {
    const { fontId } = req.body;
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (!project.fonts.includes(fontId)) {
      project.fonts.push(fontId);
      await project.save();
    }

    res.json(project);
  } catch (err) {
    console.error('❌ Error adding font to project:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ DELETE /api/projects/:id/fonts/:fontId – Remove font from project
router.delete('/:id/fonts/:fontId', jwtAuth, async (req, res) => {
  try {
    const { id, fontId } = req.params;
    const project = await Project.findOne({ _id: id, userId: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    project.fonts = project.fonts.filter(f => f.toString() !== fontId);
    await project.save();

    res.json(project);
  } catch (err) {
    console.error('❌ Error removing font from project:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
