import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineProject from '../../models/projects.js';
import authMiddleware from '../../middleware/auth.js';
import { normalizeTestUrl } from './testUrl.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const Project = defineProject(sequelize, DataTypes);

  router.post('/', verifySignedIn, async (req, res) => {
    try {
      const { name, detail, isPublic, testUrl } = req.body;

      // Même barrière qu'à l'édition : une adresse hostile ne doit pas pouvoir
      // entrer par la porte de la création.
      let normalizedTestUrl;
      try {
        normalizedTestUrl = normalizeTestUrl(testUrl);
      } catch {
        return res.status(400).json({ error: 'testUrl must be an http or https address' });
      }

      const newProject = await Project.create({
        name,
        detail,
        isPublic,
        testUrl: normalizedTestUrl,
        userId: req.userId,
      });
      res.json(newProject);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
