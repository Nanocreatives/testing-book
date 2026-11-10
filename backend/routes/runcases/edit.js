import express from 'express';
const router = express.Router();
import { DataTypes } from 'sequelize';
import defineRunCase from '../../models/runCases.js';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import { applyVerdict } from '../runs/applyVerdict.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectReporterFromRunId } = editableMiddleware(sequelize);
  const RunCase = defineRunCase(sequelize, DataTypes);

  router.post('/update', verifySignedIn, verifyProjectReporterFromRunId, async (req, res) => {
    const runId = req.query.runId;
    const runCases = req.body;
    const t = await sequelize.transaction();

    const createRunCase = async (runCase) => {
      // Le statut n'est plus écrit directement : il se dérive des verdicts, et
      // deux sources de vérité pour un même avis divergeraient à la première
      // écriture ratée.
      const newRunCase = await RunCase.create(
        {
          runId: runId,
          caseId: runCase.caseId,
          status: 0,
        },
        { transaction: t }
      );
      if (runCase.status !== 0) {
        await applyVerdict(sequelize, {
          runCaseId: newRunCase.id,
          userId: req.userId,
          status: runCase.status,
          transaction: t,
        });
        newRunCase.status = runCase.status;
      }
      return newRunCase;
    };

    const deleteRunCase = async (runCase) => {
      await RunCase.destroy({
        where: { runId: runId, caseId: runCase.caseId },
        transaction: t,
      });
      return null;
    };

    const updateRunCase = async (runCase) => {
      // Changer un statut, c'est désormais poser SON avis : celui de qui écrit,
      // pas un verdict d'autorité qui effacerait ceux des autres.
      const aggregate = await applyVerdict(sequelize, {
        runCaseId: runCase.id,
        userId: req.userId,
        status: runCase.status,
        transaction: t,
      });
      return { ...runCase, status: aggregate };
    };

    try {
      const results = await Promise.all(
        runCases.map(async (step) => {
          if (step.editState === 'new') {
            return createRunCase(step);
          } else if (step.editState === 'deleted') {
            return deleteRunCase(step);
          } else if (step.editState === 'changed') {
            return updateRunCase(step);
          } else if (step.editState === 'notChanged') {
            return step;
          }
        })
      );

      await t.commit();
      res.json(results.filter((result) => result !== null));
    } catch (error) {
      console.error(error);
      await t.rollback();
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
