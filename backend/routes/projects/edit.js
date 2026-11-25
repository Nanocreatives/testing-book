import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineProject from '../../models/projects.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import { normalizeTestUrl } from './testUrl.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectOwner } = editableMiddleware(sequelize);
  const Project = defineProject(sequelize, DataTypes);

  router.put('/:projectId', verifySignedIn, verifyProjectOwner, async (req, res) => {
    const projectId = req.params.projectId;
    const { name, detail, isPublic, testUrl } = req.body;

    // L'adresse est refusée ici ou nulle part : c'est la seule barrière qu'un
    // appel direct ne contourne pas.
    let normalizedTestUrl;
    try {
      normalizedTestUrl = normalizeTestUrl(testUrl);
    } catch {
      return res.status(400).json({ error: 'testUrl must be an http or https address' });
    }

    try {
      const project = await Project.findByPk(projectId);
      if (!project) {
        return res.status(404).send('Project not found');
      }
      await project.update({
        name,
        detail,
        isPublic,
        testUrl: normalizedTestUrl,
      });
      res.json(project);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
