// routes/publicFontRoutes.js
import express from 'express';
import Project from '../models/projects.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const router = express.Router();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Public route: Generate @font-face CSS for a project
 * Example: GET /public/projects/my-project/fonts.css
 */
router.get('/projects/:slug/fonts.css', async (req, res) => {
  try {
    const project = await Project.findOne({ slug: req.params.slug }).populate('fonts');
    if (!project) return res.status(404).send('/* Project not found */');

    // Generate signed URLs for each font
    const cssRules = await Promise.all(project.fonts.map(async (font) => {
      const signedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: font.originalFile, // from your MongoDB record
        }),
        { expiresIn: 3600 } // 1 hour expiry
      );

      return `
@font-face {
  font-family: '${font.fullName || font.name || 'CustomFont'}';
  src: url('${signedUrl}') format('truetype');
  font-weight: ${font.weight || 'normal'};
  font-style: ${font.style || 'normal'};
}
`;
    }));

    res.setHeader('Content-Type', 'text/css');
    res.send(cssRules.join('\n'));
  } catch (err) {
    console.error('❌ Error generating font-face CSS:', err);
    res.status(500).send('/* Server error */');
  }
});

export default router;
