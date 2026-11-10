import express from 'express';
const router = express.Router();
import { DataTypes, Op } from 'sequelize';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';

/** Au-delà, l'objectif ne serait plus un objectif mais un blocage. */
const MAX_VERDICTS = 10;

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectDeveloperFromProjectId } = editableMiddleware(sequelize);
  const Case = defineCase(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);

  router.put('/verdicts-expected', verifySignedIn, verifyProjectDeveloperFromProjectId, async (req, res) => {
    try {
      const projectId = req.query.projectId;
      const { caseIds, verdictsExpected } = req.body;

      if (!Array.isArray(caseIds) || caseIds.length === 0) {
        return res.status(400).json({ error: 'caseIds must be a non-empty array' });
      }
      if (!Number.isInteger(verdictsExpected) || verdictsExpected < 1 || verdictsExpected > MAX_VERDICTS) {
        return res.status(400).json({ error: `verdictsExpected must be an integer between 1 and ${MAX_VERDICTS}` });
      }

      // Les cas sont adressés par leur seul identifiant : le projet doit donc
      // être prouvé ici, sinon un développeur pourrait requalifier les cas d'un
      // autre projet.
      const folders = await Folder.findAll({ where: { projectId: projectId }, attributes: ['id'] });
      const [updated] = await Case.update(
        { verdictsExpected: verdictsExpected },
        {
          where: {
            id: { [Op.in]: caseIds },
            folderId: { [Op.in]: folders.map((folder) => folder.id) },
          },
        }
      );

      res.json({ updated });
    } catch (error) {
      console.error('Error updating expected verdicts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
