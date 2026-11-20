import express from 'express';
const router = express.Router();
import { DataTypes, Op } from 'sequelize';
import authMiddleware from '../../middleware/auth.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import defineRunCase from '../../models/runCases.js';
import defineRunCaseVerdict from '../../models/runCaseVerdicts.js';
import defineUser from '../../models/users.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectManagerFromRunId } = editableMiddleware(sequelize);
  const RunCase = defineRunCase(sequelize, DataTypes);
  const RunCaseVerdict = defineRunCaseVerdict(sequelize, DataTypes);
  const User = defineUser(sequelize, DataTypes);

  /**
   * Qui a jugé ces cas, pour que l'écran le dise AVANT d'effacer.
   *
   * Supprimer le travail de quelqu'un ne doit jamais arriver par surprise : la
   * modale nomme les personnes dont l'avis va disparaître.
   */
  router.get('/verdicts', verifySignedIn, verifyProjectManagerFromRunId, async (req, res) => {
    try {
      const runCaseIds = String(req.query.runCaseIds ?? '')
        .split(',')
        .map((value) => parseInt(value.trim(), 10))
        .filter(Number.isInteger);

      if (runCaseIds.length === 0) {
        return res.json([]);
      }

      const verdicts = await RunCaseVerdict.findAll({
        where: { runCaseId: { [Op.in]: runCaseIds } },
        attributes: ['runCaseId', 'userId', 'status'],
      });

      const userIds = [...new Set(verdicts.map((verdict) => verdict.userId).filter(Boolean))];
      const users = userIds.length
        ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'username'] })
        : [];
      const usernameById = new Map(users.map((user) => [user.id, user.username]));

      res.json(
        verdicts.map((verdict) => ({
          runCaseId: verdict.runCaseId,
          userId: verdict.userId,
          username: verdict.userId ? (usernameById.get(verdict.userId) ?? '') : '',
          status: verdict.status,
        }))
      );
    } catch (error) {
      console.error('Error reading verdicts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Remet des cas « à faire » en effaçant TOUS leurs avis.
   *
   * Réservé au gestionnaire, et distinct de la liste déroulante de statut :
   * celle-ci ne touche que l'avis de qui l'utilise, ce qui est juste quand on
   * joue et faux quand un énoncé a changé et qu'il faut tout rejouer.
   */
  router.delete('/verdicts', verifySignedIn, verifyProjectManagerFromRunId, async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const { runCaseIds } = req.body;
      if (!Array.isArray(runCaseIds) || runCaseIds.length === 0) {
        await t.rollback();
        return res.status(400).json({ error: 'runCaseIds must be a non-empty array' });
      }

      const runId = Number(req.query.runId);
      // Les cas sont adressés par leur identifiant : la campagne se prouve ici,
      // sinon un gestionnaire effacerait les avis d'une autre campagne.
      const cibles = await RunCase.findAll({
        where: { id: { [Op.in]: runCaseIds }, runId: runId },
        attributes: ['id'],
        transaction: t,
      });
      const ids = cibles.map((runCase) => runCase.id);

      if (ids.length === 0) {
        await t.commit();
        return res.json({ reset: 0 });
      }

      const effaces = await RunCaseVerdict.destroy({
        where: { runCaseId: { [Op.in]: ids } },
        transaction: t,
      });
      await RunCase.update({ status: 0 }, { where: { id: { [Op.in]: ids } }, transaction: t });

      await t.commit();
      res.json({ reset: ids.length, verdictsRemoved: effaces });
    } catch (error) {
      console.error('Error resetting run cases:', error);
      await t.rollback();
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
