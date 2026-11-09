import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import { fetchRunOrder, gateFor, roleIndex } from './caseGate.js';
import defineRun from '../../models/runs.js';
import authMiddleware from '../../middleware/auth.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';
import editableMiddleware from '../../middleware/verifyEditable.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromRunId } = visibilityMiddleware(sequelize);
  const { getProjectRole } = editableMiddleware(sequelize);
  const Run = defineRun(sequelize, DataTypes);

  router.get('/:runId/gate', verifySignedIn, verifyProjectVisibleFromRunId, async (req, res) => {
    try {
      const { runId } = req.params;

      const run = await Run.findByPk(runId);
      if (!run) {
        return res.status(404).send('Run not found');
      }

      const role = await getProjectRole(run.projectId, req.userId);
      const order = await fetchRunOrder(sequelize, run.projectId, runId);

      // A manager coordinates the others; holding them to the same order would
      // stop them from unblocking anyone.
      const own =
        role === 'manager' || role === null ? { blocking: [], blockedCaseIds: [] } : gateFor(order, roleIndex(role));
      // What the reporter is waiting on, so a manager or a developer can see
      // whom their own unfinished cases are holding up.
      const reporter = gateFor(order, roleIndex('reporter'));

      res.json({
        role,
        blocking: own.blocking,
        blockedCaseIds: own.blockedCaseIds,
        reporterBlocking: role === 'reporter' ? [] : reporter.blocking,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
