import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineProject from '../../models/projects.js';
import defineFolder from '../../models/folders.js';
import defineCase from '../../models/cases.js';
import defineRun from '../../models/runs.js';
import defineRunCase from '../../models/runCases.js';
import authMiddleware from '../../middleware/auth.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromProjectId } = visibilityMiddleware(sequelize);

  const Project = defineProject(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);
  const Case = defineCase(sequelize, DataTypes);
  const Run = defineRun(sequelize, DataTypes);
  const RunCase = defineRunCase(sequelize, DataTypes);
  Project.hasMany(Folder, { foreignKey: 'projectId' });
  Folder.hasMany(Case, { foreignKey: 'folderId' });
  Project.hasMany(Run, { foreignKey: 'projectId' });
  Run.hasMany(RunCase, { foreignKey: 'runId' });

  router.get('/:projectId', verifySignedIn, verifyProjectVisibleFromProjectId, async (req, res) => {
    const projectId = req.params.projectId;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    try {
      const project = await Project.findByPk(projectId);
      if (!project) {
        return res.status(404).send('Project not found');
      }

      // Deux branches `hasMany` dans UNE requête produisent un produit
      // cartésien : folders × cases × runs × runCases. Sur un projet d'un
      // millier de cas et neuf campagnes, c'est le million de lignes — chacune
      // portant le texte complet du cas — et le processus meurt sur « heap out
      // of memory » sans jamais répondre.
      //
      // Deux requêtes séparées, chacune avec un seul join, et seulement les
      // colonnes que la page agrège réellement : les compteurs, le type et la
      // priorité des cas, le statut et la date des rattachements.
      const [folders, runs] = await Promise.all([
        Folder.findAll({
          where: { projectId },
          attributes: ['id'],
          include: [{ model: Case, attributes: ['id', 'type', 'priority'] }],
        }),
        Run.findAll({
          where: { projectId },
          attributes: ['id'],
          include: [{ model: RunCase, attributes: ['id', 'status', 'createdAt'] }],
        }),
      ]);

      res.json({ ...project.toJSON(), Folders: folders, Runs: runs });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
