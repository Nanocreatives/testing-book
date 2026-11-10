import express from 'express';
const router = express.Router();
import { DataTypes, Op } from 'sequelize';
import defineProject from '../../models/projects.js';
import defineFolder from '../../models/folders.js';
import defineCase from '../../models/cases.js';
import defineTag from '../../models/tags.js';
import defineRunCase from '../../models/runCases.js';
import authMiddleware from '../../middleware/auth.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import defineMember from '../../models/members.js';
import defineRunCaseVerdict from '../../models/runCaseVerdicts.js';
import { isBlindForViewer, publishedStatus } from '../runs/blindVerdicts.js';
import { roleIndex } from '../runs/caseGate.js';

export default function (sequelize) {
  const Project = defineProject(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);
  const Case = defineCase(sequelize, DataTypes);
  const RunCase = defineRunCase(sequelize, DataTypes);
  const Tags = defineTag(sequelize, DataTypes);
  const Member = defineMember(sequelize, DataTypes);
  const RunCaseVerdict = defineRunCaseVerdict(sequelize, DataTypes);
  Project.hasMany(Folder, { foreignKey: 'projectId' });
  Folder.hasMany(Case, { foreignKey: 'folderId' });
  Folder.belongsTo(Project, { foreignKey: 'projectId' });
  Case.belongsTo(Folder, { foreignKey: 'folderId' });
  Case.hasMany(RunCase, { foreignKey: 'caseId' });
  Case.belongsToMany(Tags, { through: 'caseTags', foreignKey: 'caseId', otherKey: 'tagId' });
  Tags.belongsToMany(Case, { through: 'caseTags', foreignKey: 'tagId', otherKey: 'caseId' });
  RunCase.belongsTo(Case, { foreignKey: 'caseId' });
  const { verifySignedIn } = authMiddleware(sequelize);
  const { verifyProjectVisibleFromProjectId } = visibilityMiddleware(sequelize);
  const { verifyProjectVisibleFromRunId } = visibilityMiddleware(sequelize);
  const { getProjectRole } = editableMiddleware(sequelize);

  /**
   * Retire des cas rendus le verdict des autres, tant que le lecteur ne s'est
   * pas prononcé et que le cas en attend encore un.
   *
   * Les objets Sequelize sont aplatis d'abord : on publie du JSON, et modifier
   * une instance en place laisserait le statut d'origine dans ses dataValues.
   */
  async function blindOthersVerdicts(cases, projectId, viewerId) {
    const plain = cases.map((testCase) => testCase.get({ plain: true }));
    const runCaseIds = plain.flatMap((testCase) => (testCase.RunCases ?? []).map((runCase) => runCase.id));
    if (runCaseIds.length === 0) {
      return plain;
    }

    const [verdicts, members] = await Promise.all([
      RunCaseVerdict.findAll({
        where: { runCaseId: { [Op.in]: runCaseIds } },
        attributes: ['runCaseId', 'userId', 'status'],
      }),
      Member.findAll({ where: { projectId: projectId }, attributes: ['role'] }),
    ]);

    const byRunCase = new Map();
    for (const verdict of verdicts) {
      const bucket = byRunCase.get(verdict.runCaseId) ?? [];
      bucket.push(verdict);
      byRunCase.set(verdict.runCaseId, bucket);
    }
    const memberRoles = members.map((member) => member.role);

    for (const testCase of plain) {
      const ownerRole = testCase.ownerRole ?? null;
      const eligibleCount = memberRoles.filter((entry) => ownerRole === null || entry === ownerRole).length;

      for (const runCase of testCase.RunCases ?? []) {
        const given = byRunCase.get(runCase.id) ?? [];
        const blind = isBlindForViewer({
          statuses: given.map((verdict) => verdict.status),
          viewerHasVoted: given.some((verdict) => verdict.userId === viewerId),
          expected: testCase.verdictsExpected ?? 1,
          eligibleCount,
        });
        runCase.status = publishedStatus({ status: runCase.status, blind });
        runCase.blind = blind;
      }
    }

    return plain;
  }

  router.get(
    '/byproject',
    verifySignedIn,
    verifyProjectVisibleFromProjectId,
    verifyProjectVisibleFromRunId,
    async (req, res) => {
      const { projectId, runId, status, tag, search, assigneeUserId } = req.query;

      if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
      }

      if (!runId) {
        return res.status(400).json({ error: 'runId is required' });
      }

      try {
        // Build where clause for Case model
        const caseWhereClause = {};

        // Handle search parameter
        if (search) {
          const searchTerm = search.trim();

          if (searchTerm.length > 100) {
            return res.status(400).json({ error: 'too long search param' });
          }

          if (searchTerm.length >= 1) {
            caseWhereClause[Op.or] = [
              { title: { [Op.like]: `%${searchTerm}%` } },
              { description: { [Op.like]: `%${searchTerm}%` } },
            ];
          }
        }

        // Handle status filter for RunCase
        let statusFilter = undefined;
        let assigneeFilter = undefined;
        let runCaseRequired = false;
        if (status) {
          const statusValues = status
            .split(',')
            .map((t) => parseInt(t.trim(), 10))
            .filter((t) => !isNaN(t));

          if (statusValues.length > 0) {
            statusFilter = { status: { [Op.in]: statusValues } };
            runCaseRequired = true;
          }
        }

        if (assigneeUserId !== undefined) {
          if (assigneeUserId === 'null') {
            assigneeFilter = { assigneeUserId: { [Op.is]: null } };
          } else {
            const assigneeId = Number(assigneeUserId);
            if (!Number.isInteger(assigneeId) || assigneeId <= 0) {
              return res.status(400).json({ error: 'assigneeUserId must be a positive integer or "null"' });
            }
            assigneeFilter = { assigneeUserId: assigneeId };
          }
          runCaseRequired = true;
        }

        // Handle tag filter
        const tagInclude = {
          model: Tags,
          attributes: ['id', 'name'],
          through: { attributes: [] },
        };

        if (tag) {
          const tagIds = tag
            .split(',')
            .map((t) => parseInt(t.trim(), 10))
            .filter((t) => !isNaN(t));

          if (tagIds.length > 0) {
            tagInclude.where = { id: { [Op.in]: tagIds } };
            tagInclude.required = true;
          }
        }

        const cases = await Case.findAll({
          where: caseWhereClause,
          include: [
            {
              model: Folder,
              where: {
                projectId: projectId,
              },
              attributes: [],
            },
            {
              model: RunCase,
              attributes: [
                'id',
                'runId',
                'status',
                'assigneeUserId',
                [
                  sequelize.literal(
                    '(SELECT COUNT(*) FROM `comments` WHERE `comments`.`commentableType` = ' +
                      sequelize.escape('RunCase') +
                      ' AND `comments`.`commentableId` = `RunCases`.`id`)'
                  ),
                  'commentCount',
                ],
              ],
              // Must be 'true' when filtering by status or assignee, otherwise all cases are returned.
              required: runCaseRequired,
              where: {
                [Op.and]: [{ runId: runId }, statusFilter, assigneeFilter].filter(Boolean),
              },
            },
            tagInclude,
          ],
        });
        // A reporter is shown their own share only: the rest is someone else's
        // work, and a list they cannot act on is noise they have to re-read.
        const role = await getProjectRole(projectId, req.userId);
        const reporterRole = roleIndex('reporter');
        const visible =
          role === 'reporter'
            ? cases.filter((testCase) => testCase.ownerRole === null || testCase.ownerRole === reporterRole)
            : cases;

        const blinded = await blindOthersVerdicts(visible, projectId, req.userId);

        // Le filtre de statut a tourné en SQL, donc AVANT le masquage : sans ce
        // second passage, filtrer sur « Réussi » révélerait les cas masqués en
        // les faisant apparaître sous ce statut.
        if (!statusFilter) {
          return res.json(blinded);
        }
        const wanted = status
          .split(',')
          .map((value) => parseInt(value.trim(), 10))
          .filter((value) => !isNaN(value));
        res.json(
          blinded.filter((testCase) =>
            (testCase.RunCases ?? []).every((runCase) => !runCase.blind || wanted.includes(0))
          )
        );
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    }
  );

  return router;
}
