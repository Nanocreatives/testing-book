import express from 'express';
const router = express.Router();
import { DataTypes, Op } from 'sequelize';
import { memberRoles } from '../users/authSettings.js';
import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectDeveloperFromProjectId } = editableMiddleware(sequelize);
  const Case = defineCase(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);

  router.put('/role', verifySignedIn, verifyProjectDeveloperFromProjectId, async (req, res) => {
    try {
      const projectId = req.query.projectId;
      const { caseIds, ownerRole } = req.body;

      if (!Array.isArray(caseIds) || caseIds.length === 0) {
        return res.status(400).json({ error: 'caseIds must be a non-empty array' });
      }
      if (ownerRole !== null && !memberRoles[ownerRole]) {
        return res.status(400).json({ error: 'ownerRole must be null or a member role' });
      }

      // Cases are addressed by id alone, so the project has to be proven here:
      // without this, any developer could relabel another project's cases.
      const folders = await Folder.findAll({ where: { projectId: projectId }, attributes: ['id'] });
      const [updated] = await Case.update(
        { ownerRole: ownerRole },
        {
          where: {
            id: { [Op.in]: caseIds },
            folderId: { [Op.in]: folders.map((folder) => folder.id) },
          },
        }
      );

      res.json({ updated });
    } catch (error) {
      console.error('Error updating case roles:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
