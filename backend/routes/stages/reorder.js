import express from 'express';
const router = express.Router();
import { DataTypes, Op } from 'sequelize';
import defineStage from '../../models/stages.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectManagerFromProjectId } = editableMiddleware(sequelize);
  const Stage = defineStage(sequelize, DataTypes);

  router.put('/reorder', verifySignedIn, verifyProjectManagerFromProjectId, async (req, res) => {
    try {
      const projectId = req.query.projectId;
      const { stageIds } = req.body;

      if (!Array.isArray(stageIds)) {
        return res.status(400).json({ error: 'stageIds must be an array' });
      }

      const stages = await Stage.findAll({
        where: { projectId: projectId, id: { [Op.in]: stageIds } },
        attributes: ['id'],
      });
      // A partial order would leave two stages claiming the same rank, so the
      // client has to send the whole path back.
      if (stages.length !== stageIds.length) {
        return res.status(400).json({ error: 'stageIds must list every stage of the project' });
      }

      await sequelize.transaction(async (transaction) => {
        await Promise.all(
          stageIds.map((stageId, position) =>
            Stage.update({ position }, { where: { id: stageId }, transaction: transaction })
          )
        );
      });

      res.json({ message: 'Stages reordered successfully' });
    } catch (error) {
      console.error('Error reordering stages:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
