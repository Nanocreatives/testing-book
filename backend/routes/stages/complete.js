import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import { BRIEFING_KIND } from './pathState.js';
import defineStage from '../../models/stages.js';
import defineStageCompletion from '../../models/stageCompletions.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectReporterFromStageId } = editableMiddleware(sequelize);
  const Stage = defineStage(sequelize, DataTypes);
  const StageCompletion = defineStageCompletion(sequelize, DataTypes);

  router.post('/:stageId/complete', verifySignedIn, verifyProjectReporterFromStageId, async (req, res) => {
    try {
      const { stageId } = req.params;

      const stage = await Stage.findByPk(stageId);
      if (!stage) {
        return res.status(404).send('Stage not found');
      }
      // A run stage is cleared by working through its cases, never by saying so.
      if (stage.kind !== BRIEFING_KIND) {
        return res.status(400).json({ error: 'only a briefing stage can be acknowledged' });
      }

      const [completion] = await StageCompletion.findOrCreate({
        where: { stageId: stage.id, userId: req.userId },
      });

      res.json(completion);
    } catch (error) {
      console.error('Error completing stage:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
