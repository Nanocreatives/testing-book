import express from 'express';
const router = express.Router();
import { DataTypes, Op } from 'sequelize';
import defineProject from '../../models/projects.js';
import defineFolder from '../../models/folders.js';
import defineCase from '../../models/cases.js';
import defineTag from '../../models/tags.js';
import defineRunCase from '../../models/runCases.js';
import defineRunCaseVerdict from '../../models/runCaseVerdicts.js';
import defineComment from '../../models/comments.js';
import defineUser from '../../models/users.js';
import authMiddleware from '../../middleware/auth.js';
import visibilityMiddleware from '../../middleware/verifyVisible.js';
import editableMiddleware from '../../middleware/verifyEditable.js';
import { roleIndex } from '../runs/caseGate.js';
import { groupAuthorsByRunCase, attachAuthors } from './caseAuthors.js';

export default function (sequelize) {
  const Project = defineProject(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);
  const Case = defineCase(sequelize, DataTypes);
  const RunCase = defineRunCase(sequelize, DataTypes);
  const Tags = defineTag(sequelize, DataTypes);
  const RunCaseVerdict = defineRunCaseVerdict(sequelize, DataTypes);
  const Comment = defineComment(sequelize, DataTypes);
  const User = defineUser(sequelize, DataTypes);
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

  /** Les avis et les commentateurs des cas rendus, en trois requêtes à plat. */
  async function readAuthors(cases) {
    const runCaseIds = cases
      .flatMap((testCase) => testCase.RunCases ?? [])
      .map((runCase) => runCase.id)
      .filter((id) => Number.isInteger(id) && id > 0);

    if (runCaseIds.length === 0) {
      return new Map();
    }

    const [verdicts, comments] = await Promise.all([
      RunCaseVerdict.findAll({
        where: { runCaseId: { [Op.in]: runCaseIds } },
        attributes: ['runCaseId', 'userId', 'status'],
        order: [
          ['createdAt', 'ASC'],
          ['id', 'ASC'],
        ],
      }),
      Comment.findAll({
        where: { commentableType: 'RunCase', commentableId: { [Op.in]: runCaseIds } },
        attributes: ['commentableId', 'userId'],
        order: [['createdAt', 'ASC']],
      }),
    ]);

    const userIds = [
      ...new Set([...verdicts.map((verdict) => verdict.userId), ...comments.map((comment) => comment.userId)]),
    ].filter(Boolean);
    const users = userIds.length
      ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'username'] })
      : [];

    return groupAuthorsByRunCase(
      verdicts,
      comments.map((comment) => ({ runCaseId: comment.commentableId, userId: comment.userId })),
      new Map(users.map((user) => [user.id, user.username]))
    );
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
        // Un statut sans son auteur n'est qu'une rumeur : la liste nomme qui a
        // jugé et qui a commenté, pour que la personne suivante sache sur quoi
        // elle s'appuie avant de rejouer un cas.
        const withAuthors = attachAuthors(cases, await readAuthors(cases));

        // A reporter is shown their own share only: the rest is someone else's
        // work, and a list they cannot act on is noise they have to re-read.
        const role = await getProjectRole(projectId, req.userId);
        if (role !== 'reporter') {
          return res.json(withAuthors);
        }

        const reporterRole = roleIndex('reporter');
        res.json(withAuthors.filter((testCase) => testCase.ownerRole === null || testCase.ownerRole === reporterRole));
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    }
  );

  return router;
}
