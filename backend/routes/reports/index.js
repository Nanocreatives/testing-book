import express from 'express';
const router = express.Router();
import { DataTypes, Op } from 'sequelize';
import authMiddleware from '../../middleware/auth.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';
import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import defineMember from '../../models/members.js';
import defineRun from '../../models/runs.js';
import defineRunCase from '../../models/runCases.js';
import defineRunCaseVerdict from '../../models/runCaseVerdicts.js';
import defineUser from '../../models/users.js';
import { buildTrackingReport } from './trackingReport.js';

export default function (sequelize) {
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromProjectId } = visibilityMiddleware(sequelize);

  const Case = defineCase(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);
  const Member = defineMember(sequelize, DataTypes);
  const Run = defineRun(sequelize, DataTypes);
  const RunCase = defineRunCase(sequelize, DataTypes);
  const RunCaseVerdict = defineRunCaseVerdict(sequelize, DataTypes);
  const User = defineUser(sequelize, DataTypes);

  router.get('/tracking/:projectId', verifySignedIn, verifyProjectVisibleFromProjectId, async (req, res) => {
    const projectId = req.params.projectId;

    // `?status=1,2` restreint tout le rapport — compteurs, campagnes, membres —
    // aux cas dont le statut agrégé est dans la liste. Vide ou absent, rien
    // n'est filtré.
    const wantedStatuses = (req.query.status ?? '')
      .split(',')
      .map((value) => parseInt(value.trim(), 10))
      .filter((value) => Number.isInteger(value));

    try {
      // Des requêtes séparées, une jointure chacune. Deux branches `hasMany`
      // dans une seule requête font un produit cartésien : sur un projet de
      // mille deux cents cas et neuf campagnes, c'est un million de lignes et le
      // processus meurt en mémoire.
      const [folders, runs, members] = await Promise.all([
        Folder.findAll({ where: { projectId: projectId }, attributes: ['id'] }),
        Run.findAll({ where: { projectId: projectId }, attributes: ['id', 'name'] }),
        Member.findAll({ where: { projectId: projectId }, attributes: ['userId', 'role'] }),
      ]);

      const folderIds = folders.map((folder) => folder.id);
      const runIds = runs.map((run) => run.id);

      const [cases, runCases, users] = await Promise.all([
        folderIds.length
          ? Case.findAll({
              where: { folderId: { [Op.in]: folderIds } },
              attributes: ['id', 'ownerRole', 'verdictsExpected'],
            })
          : [],
        runIds.length
          ? RunCase.findAll({ where: { runId: { [Op.in]: runIds } }, attributes: ['id', 'runId', 'caseId'] })
          : [],
        members.length
          ? User.findAll({
              where: { id: { [Op.in]: members.map((member) => member.userId) } },
              attributes: ['id', 'username'],
            })
          : [],
      ]);

      const verdicts = runCases.length
        ? await RunCaseVerdict.findAll({
            where: { runCaseId: { [Op.in]: runCases.map((runCase) => runCase.id) } },
            attributes: ['runCaseId', 'userId', 'status'],
          })
        : [];

      const usernameById = new Map(users.map((user) => [user.id, user.username]));

      res.json(
        buildTrackingReport({
          cases: cases.map((entry) => ({
            id: entry.id,
            ownerRole: entry.ownerRole,
            verdictsExpected: entry.verdictsExpected,
          })),
          runCases: runCases.map((entry) => ({ id: entry.id, runId: entry.runId, caseId: entry.caseId })),
          verdicts: verdicts.map((entry) => ({
            runCaseId: entry.runCaseId,
            userId: entry.userId,
            status: entry.status,
          })),
          members: members.map((member) => ({
            userId: member.userId,
            username: usernameById.get(member.userId) ?? '',
            role: member.role,
          })),
          runs: runs.map((run) => ({ id: run.id, name: run.name })),
          statuses: wantedStatuses,
        })
      );
    } catch (error) {
      console.error('Error building tracking report:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
