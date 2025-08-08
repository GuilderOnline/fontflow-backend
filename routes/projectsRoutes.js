import express from 'express';
import Project from '../models/projects.js';
import Font from '../models/font.js';
import ApiKey from '../models/APIKey.js';
import slugify from 'slugify';
import { jwtAuth } from '../middleware/jwtAuth.js';

const router = express.Router();

// GET /api/projects (secured) – Get all projects for the authenticated user
router.get('/', jwtAuth, async (req, res) => {
  try {
    // Find projects owned by the authenticated user and populate fonts
    const projects = await Project.find({ userId: req.user.id }).populate('fonts');
    res.json(projects);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/projects/:slug – Get a single project by slug
router.get('/:slug', jwtAuth, async (req, res) => {
  try {
    // Find project by slug and user, populate fonts
    const project = await Project.findOne({ slug: req.params.slug, userId: req.user.id }).populate('fonts');
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/projects/:id/apikeys – Get API keys associated with a project
router.get('/:id/apikeys', jwtAuth, async (req, res) => {
  try {
    // Find API keys for project and user
    const keys = await ApiKey.find({ projectId: req.params.id, userId: req.user.id });
    res.json(keys);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// POST /api/projects – Create a new project
router.post('/', jwtAuth, async (req, res) => {
  try {
    const { name, url, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name is required' });

    // Generate slug from project name
    const slug = slugify(name, { lower: true, strict: true });

    // Create new project document
    const project = new Project({
      name,
      url,
      description,
      slug,
      userId: req.user.id,
      fonts: [],
    });

    // Save project to DB
    const saved = await project.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('Error in POST /api/projects:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/projects/:id – Update an existing project
router.put('/:id', jwtAuth, async (req, res) => {
  try {
    const { name, url, description } = req.body;
    const project = await Project.findById(req.params.id);

    // Check ownership
    if (!project || project.userId.toString() !== req.user.id) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    // Update fields
    project.name = name || project.name;
    project.url = url || project.url;
    project.description = description || project.description;

    // Save updated project
    const updatedProject = await project.save();
    res.json(updatedProject);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/projects/:id – Delete a project (with debug logs)
router.delete('/:id', jwtAuth, async (req, res) => {
  try {
    console.log('DELETE request for project ID:', req.params.id);
    console.log('Authenticated user:', req.user);

    const project = await Project.findById(req.params.id);
    console.log('Found project:', project);

    if (!project) {
      console.log('Project not found');
      return res.status(404).json({ error: 'Project not found' });
    }

    // Ownership check
    if (!req.user?.id) {
      console.log('No req.user.id found — JWT issue');
      return res.status(401).json({ error: 'User authentication failed' });
    }

    if (project.userId?.toString() !== req.user.id) {
      console.log('Ownership mismatch: project.user =', project.user.toString(), 'req.user.id =', req.user.id);
      return res.status(403).json({ error: 'Not authorized to delete this project' });
    }

    // Delete project from DB
    await project.deleteOne();
    console.log('Project deleted successfully');

    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/projects/:id/fonts – Add a font to a project
router.post('/:id/fonts', jwtAuth, async (req, res) => {
  try {
    const { fontId } = req.body;
    // Find project by ID and user
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Add font to project if not already assigned
    if (!project.fonts.includes(fontId)) {
      project.fonts.push(fontId);
      await project.save();
    }

    res.json(project);
  } catch (err) {
    console.error('Error adding font to project:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/projects/:id/fonts/:fontId – Remove a font from a project
router.delete('/:id/fonts/:fontId', jwtAuth, async (req, res) => {
  try {
    const { id, fontId } = req.params;
    // Find project by ID and user
    const project = await Project.findOne({ _id: id, userId: req.user.id });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Remove font from project
    project.fonts = project.fonts.filter(f => f.toString() !== fontId);
    await project.save();

    res.json(project);
  } catch (err) {
    console.error('Error removing font from project:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/projects/:id/generate-code – Generate Embed & CSS Code for a Project
router.get('/:id/generate-code', jwtAuth, async (req, res) => {
  try {
    // Find project and populate fonts
    const project = await Project.findById(req.params.id).populate('fonts');
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const fonts = project.fonts;

    // Generate embed and CSS code
    const { embedCode, cssCode } = generateCode(fonts);

    res.json({ embedCode, cssCode });
  } catch (err) {
    console.error('Error generating code:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Function to generate embed and CSS code based on fonts
function generateCode(fonts) {
  const cssText = fonts
    .map(font => {
      const fontFamilyName = font.fullName || font.family || "CustomFont";

      // Prefer woff2, fallback to original
      const fileKey = font.woff2File || font.originalFile || font.file;
      if (!fileKey) {
        console.warn(`Skipping font "${fontFamilyName}" because no file is defined.`);
        return "";
      }

      // Build font file URL and format
      const fontFileUrl = `https://fontflowbucket.s3.eu-north-1.amazonaws.com/${fileKey}`;
      const formatType = fileKey.toLowerCase().endsWith('.woff2')
        ? 'woff2'
        : fileKey.toLowerCase().endsWith('.woff')
          ? 'woff'
          : 'truetype';

      // Support multiple weights if available
      const weights = Array.isArray(font.weights) && font.weights.length > 0
        ? font.weights
        : [font.weight || 400]; // fallback from DB weight or 400

      // Generate @font-face CSS for each weight
      return weights
        .map(weight => `
@font-face {
  font-family: "${fontFamilyName}";
  font-style: normal;
  font-weight: ${weight};
  src: url("${fontFileUrl}") format("${formatType}");
}`)
        .join("\n");
    })
    .join("\n");

  return { cssCode: cssText };
}

export default router;