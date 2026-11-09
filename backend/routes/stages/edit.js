import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import { BRIEFING_KIND } from './pathState.js';
import defineStage from '../../models/stages.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectManagerFromStageId } = editableMiddleware(sequelize);
  const Stage = defineStage(sequelize, DataTypes);

  router.put('/:stageId', verifySignedIn, verifyProjectManagerFromStageId, async (req, res) => {
    try {
      const { stageId } = req.params;
      const { title, content, runId } = req.body;

      const stage = await Stage.findByPk(stageId);
      if (!stage) {
        return res.status(404).send('Stage not found');
      }
      if (!title) {
        return res.status(400).json({ error: 'title is required' });
      }

      // The kind is fixed at creation: a briefing and a run stage do not hold
      // the same thing, and swapping one for the other would strand its content.
      await stage.update({
        title,
        content: stage.kind === BRIEFING_KIND ? content : null,
        runId: stage.kind === BRIEFING_KIND ? null : (runId ?? stage.runId),
      });

      res.json(stage);
    } catch (error) {
      console.error('Error updating stage:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
