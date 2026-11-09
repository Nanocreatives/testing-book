import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import { BRIEFING_KIND, RUN_KIND } from './pathState.js';
import defineStage from '../../models/stages.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectManagerFromProjectId } = editableMiddleware(sequelize);
  const Stage = defineStage(sequelize, DataTypes);

  router.post('/', verifySignedIn, verifyProjectManagerFromProjectId, async (req, res) => {
    try {
      const projectId = req.query.projectId;
      const { kind, title, content, runId } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'title is required' });
      }
      if (kind !== BRIEFING_KIND && kind !== RUN_KIND) {
        return res.status(400).json({ error: 'kind must be a briefing or a run' });
      }
      if (kind === RUN_KIND && !runId) {
        return res.status(400).json({ error: 'runId is required on a run stage' });
      }

      // Appending is the only sane default: a new stage must not silently take
      // the place of one the reporter already cleared.
      const last = await Stage.max('position', { where: { projectId: projectId } });
      const position = Number.isInteger(last) ? last + 1 : 0;

      const newStage = await Stage.create({
        projectId,
        position,
        kind,
        title,
        content: kind === BRIEFING_KIND ? content : null,
        runId: kind === RUN_KIND ? runId : null,
      });

      res.json(newStage);
    } catch (error) {
      console.error('Error creating new stage:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
