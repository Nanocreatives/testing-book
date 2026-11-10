import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineRun from '../../models/runs.js';
import authMiddleware from '../../middleware/auth.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';
import { buildRunTally } from './runTally.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromRunId } = visibilityMiddleware(sequelize);
  const Run = defineRun(sequelize, DataTypes);

  router.get('/:runId', verifySignedIn, verifyProjectVisibleFromRunId, async (req, res) => {
    const runId = req.params.runId;

    if (!runId) {
      return res.status(400).json({ error: 'runId is required' });
    }

    try {
      const run = await Run.findByPk(runId);
      if (!run) {
        return res.status(404).send('Run not found');
      }

      // Le comptage se dérive des verdicts, et non du statut agrégé : il doit
      // dire aussi combien de cas voient leurs testeurs diverger, et combien
      // attendent encore un avis. Le désaccord n'est pas un sixième statut —
      // les entiers stockés sont les index de `frontend/config/selection.ts`,
      // en ajouter un décalerait toutes les valeurs déjà en base.
      const { statusCounts, disagreeing, awaitingVerdicts } = await buildRunTally(sequelize, run.projectId, run.id);

      res.json({ run, statusCounts, disagreeing, awaitingVerdicts });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
