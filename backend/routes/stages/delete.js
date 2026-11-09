import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineStage from '../../models/stages.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectManagerFromStageId } = editableMiddleware(sequelize);
  const Stage = defineStage(sequelize, DataTypes);

  router.delete('/:stageId', verifySignedIn, verifyProjectManagerFromStageId, async (req, res) => {
    try {
      const { stageId } = req.params;

      const stage = await Stage.findByPk(stageId);
      if (!stage) {
        return res.status(404).send('Stage not found');
      }

      await stage.destroy();
      res.json({ message: 'Stage deleted successfully' });
    } catch (error) {
      console.error('Error deleting stage:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
