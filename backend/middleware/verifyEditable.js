import { DataTypes } from 'sequelize';
import { memberRoles } from '../routes/users/authSettings.js';
import defineMember from '../models/members.js';
import defineProject from '../models/projects.js';
import defineFolder from '../models/folders.js';
import defineCase from '../models/cases.js';
import defineRun from '../models/runs.js';
import defineStage from '../models/stages.js';
import defineRunCase from '../models/runCases.js';

export default function verifyEditableMiddleware(sequelize) {
  /**
   * Verify user has project
   * (have to be called after verifySignedIn() middleware)
   */
  async function verifyProjectOwner(req, res, next) {
    const Project = defineProject(sequelize, DataTypes);

    const projectId = req.params.projectId;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).send('Project not found');
    }

    if (project.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  }

  /**
   * Verify user is manager of the project by projectId
   * (have to be called after verifySignedIn() middleware)
   */
  async function verifyProjectManagerFromProjectId(req, res, next) {
    const Project = defineProject(sequelize, DataTypes);

    const projectId = req.params.projectId || req.query.projectId;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).send('Project not found');
    }

    if (project.userId === req.userId) {
      next();
      return;
    }

    // check the user is manager of the project
    const Member = defineMember(sequelize, DataTypes);
    const member = await Member.findOne({
      where: {
        userId: req.userId,
        projectId: projectId,
      },
    });
    if (member) {
      const managerRoleIndex = memberRoles.findIndex((entry) => entry.uid === 'manager');
      if (member.role === managerRoleIndex) {
        next();
        return;
      }
    }

    return res.status(403).json({ error: 'Forbidden' });
  }

  /**
   * Verify user is developer of the project by projectId
   * (have to be called after verifySignedIn() middleware)
   */
  async function verifyProjectDeveloperFromProjectId(req, res, next) {
    const projectId = req.params.projectId || req.query.projectId;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const isDeveloperRet = await isDeveloper(projectId, req.userId);
    if (isDeveloperRet) {
      next();
      return;
    }

    return res.status(403).json({ error: 'Forbidden' });
  }

  /**
   * Verify user is developer of the project by folderId
   * (have to be called after verifySignedIn() middleware)
   */
  async function verifyProjectDeveloperFromFolderId(req, res, next) {
    const Folder = defineFolder(sequelize, DataTypes);

    const folderId = req.params.folderId || req.query.folderId;
    if (!folderId) {
      return res.status(400).json({ error: 'folderId is required' });
    }

    // find project id from folderId
    const folder = await Folder.findByPk(folderId);
    const projectId = folder && folder.projectId;
    if (!projectId) {
      return res.status(404).send('failed to find projectId');
    }

    const isDeveloperRet = await isDeveloper(projectId, req.userId);
    if (isDeveloperRet) {
      next();
      return;
    }

    return res.status(403).json({ error: 'Forbidden' });
  }

  /**
   * Verify user is developer of the project by caseId
   * (have to be called after verifySignedIn() middleware)
   */
  async function verifyProjectDeveloperFromCaseId(req, res, next) {
    const Project = defineProject(sequelize, DataTypes);
    const Folder = defineFolder(sequelize, DataTypes);
    const Case = defineCase(sequelize, DataTypes);
    Project.hasMany(Folder, { foreignKey: 'projectId' });
    Folder.hasMany(Case, { foreignKey: 'folderId' });
    Folder.belongsTo(Project, { foreignKey: 'projectId' });
    Case.belongsTo(Folder, { foreignKey: 'folderId' });

    const caseId = req.params.caseId || req.query.caseId;
    if (!caseId) {
      return res.status(400).json({ error: 'caseId is required' });
    }

    // find project id from caseId
    const testCase = await Case.findByPk(caseId, {
      include: {
        model: Folder,
        include: Project,
      },
    });

    const projectId = testCase && testCase.Folder && testCase.Folder.Project && testCase.Folder.Project.id;
    if (!projectId) {
      return res.status(404).send('failed to find projectId');
    }

    const isDeveloperRet = await isDeveloper(projectId, req.userId);
    if (isDeveloperRet) {
      next();
      return;
    }

    return res.status(403).json({ error: 'Forbidden' });
  }

  async function isDeveloper(projectId, userId) {
    const Project = defineProject(sequelize, DataTypes);
    const Member = defineMember(sequelize, DataTypes);
    Project.hasMany(Member, { foreignKey: 'projectId' });
    Member.belongsTo(Project, { foreignKey: 'projectId' });

    const project = await Project.findOne({
      where: { id: projectId },
      include: [
        {
          model: Member,
          where: { userId: userId },
          required: false,
        },
      ],
    });
    if (!project) {
      return false;
    }

    // owner has developer or higher authority
    if (project.userId === userId) {
      return true;
    }

    const member = project.Members && project.Members[0];
    if (member) {
      const managerRoleIndex = memberRoles.findIndex((entry) => entry.uid === 'manager');
      const developerRoleIndex = memberRoles.findIndex((entry) => entry.uid === 'developer');
      if (member.role === managerRoleIndex || member.role === developerRoleIndex) {
        return true;
      }
    }

    return false;
  }

  /**
   * Verify user is reporter of the project by projectId
   * (have to be called after verifySignedIn() middleware)
   */
  async function verifyProjectReporterFromProjectId(req, res, next) {
    const projectId = req.params.projectId || req.query.projectId;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const isReporterRet = await isReporter(projectId, req.userId);
    if (isReporterRet) {
      next();
      return;
    }

    return res.status(403).json({ error: 'Forbidden' });
  }

  /**
   * Verify user is manager of the project by runId
   * (have to be called after verifySignedIn() middleware)
   */
  async function verifyProjectManagerFromRunId(req, res, next) {
    const Run = defineRun(sequelize, DataTypes);

    const runId = req.params.runId || req.query.runId;
    if (!runId) {
      return res.status(400).json({ error: 'runId is required' });
    }

    const run = await Run.findByPk(runId);
    if (!run) {
      return res.status(404).send('Run not found');
    }
    const projectId = run.projectId;

    const Project = defineProject(sequelize, DataTypes);
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).send('Project not found');
    }

    if (project.userId === req.userId) {
      next();
      return;
    }

    const Member = defineMember(sequelize, DataTypes);
    const member = await Member.findOne({
      where: { userId: req.userId, projectId: projectId },
    });
    if (member) {
      const managerRoleIndex = memberRoles.findIndex((entry) => entry.uid === 'manager');
      if (member.role === managerRoleIndex) {
        next();
        return;
      }
    }

    return res.status(403).json({ error: 'Forbidden' });
  }

  /**
   * Verify user is reporter of the project by runId
   * (have to be called after verifySignedIn() middleware)
   */
  async function verifyProjectReporterFromRunId(req, res, next) {
    const Run = defineRun(sequelize, DataTypes);

    const runId = req.params.runId || req.query.runId;
    if (!runId) {
      return res.status(400).json({ error: 'runId is required' });
    }

    // find project id from runId
    const run = await Run.findByPk(runId);
    const projectId = run && run.projectId;
    if (!projectId) {
      return res.status(404).send('failed to find projectId');
    }

    const isReporterRet = await isReporter(projectId, req.userId);
    if (isReporterRet) {
      next();
      return;
    }

    return res.status(403).json({ error: 'Forbidden' });
  }

  /**
   * Verify user is reporter of the project by CommentableId
   * (have to be called after verifySignedIn() middleware)
   */
  async function verifyProjectReporterFromCommentableId(req, res, next) {
    const commentableType = req.params.commentableType || req.query.commentableType;
    const commentableId = req.params.commentableId || req.query.commentableId;
    if (!commentableType || !commentableId) {
      return res.status(400).json({ error: 'commentableType and commentableId are required' });
    }

    if (commentableType === 'Run') {
      // not implemented yet
      next();
      return;
    } else if (commentableType === 'Case') {
      // not implemented yet
      next();
      return;
    } else if (commentableType === 'RunCase') {
      const RunCase = defineRunCase(sequelize, DataTypes);
      const runCaseId = req.params.commentableId || req.query.commentableId;
      if (!runCaseId) {
        return res.status(400).json({ error: 'runCaseId is required' });
      }

      const runCase = await RunCase.findByPk(runCaseId);
      const runId = runCase && runCase.runId;
      if (!runId) {
        return res.status(404).send('failed to find runId');
      }

      const Run = defineRun(sequelize, DataTypes);
      const run = await Run.findByPk(runId);
      const projectId = run && run.projectId;
      if (!projectId) {
        return res.status(404).send('failed to find projectId');
      }

      const isReporterRet = await isReporter(projectId, req.userId);
      if (isReporterRet) {
        next();
        return;
      }
    } else {
      return res.status(400).json({ error: 'unsupported commentableType' });
    }
  }

  /**
   * Verify user is reporter of the project by runCaseId
   * (have to be called after verifySignedIn() middleware)
   */
  async function verifyProjectReporterFromRunCaseId(req, res, next) {
    const runCaseId = req.params.runCaseId || req.query.runCaseId;
    if (!runCaseId) {
      return res.status(400).json({ error: 'runCaseId is required' });
    }

    const RunCase = defineRunCase(sequelize, DataTypes);
    const runCase = await RunCase.findByPk(runCaseId);
    const runId = runCase && runCase.runId;
    if (!runId) {
      return res.status(404).send('failed to find runId');
    }

    const Run = defineRun(sequelize, DataTypes);
    const run = await Run.findByPk(runId);
    const projectId = run && run.projectId;
    if (!projectId) {
      return res.status(404).send('failed to find projectId');
    }

    const isReporterRet = await isReporter(projectId, req.userId);
    if (isReporterRet) {
      next();
      return;
    }

    return res.status(403).json({ error: 'Forbidden' });
  }

  /**
   * Verify user is manager of the project by stageId
   * (have to be called after verifySignedIn() middleware)
   */
  async function verifyProjectManagerFromStageId(req, res, next) {
    const projectId = await projectIdFromStageId(req, res);
    if (!projectId) {
      return;
    }

    const Project = defineProject(sequelize, DataTypes);
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).send('Project not found');
    }

    if (project.userId === req.userId) {
      next();
      return;
    }

    const Member = defineMember(sequelize, DataTypes);
    const member = await Member.findOne({
      where: { userId: req.userId, projectId: projectId },
    });
    if (member) {
      const managerRoleIndex = memberRoles.findIndex((entry) => entry.uid === 'manager');
      if (member.role === managerRoleIndex) {
        next();
        return;
      }
    }

    return res.status(403).json({ error: 'Forbidden' });
  }

  /**
   * Verify user is reporter of the project by stageId
   * (have to be called after verifySignedIn() middleware)
   */
  async function verifyProjectReporterFromStageId(req, res, next) {
    const projectId = await projectIdFromStageId(req, res);
    if (!projectId) {
      return;
    }

    const isReporterRet = await isReporter(projectId, req.userId);
    if (isReporterRet) {
      next();
      return;
    }

    return res.status(403).json({ error: 'Forbidden' });
  }

  /**
   * Answers the response itself when the stage cannot be resolved, so callers
   * only have to check for a falsy return.
   */
  async function projectIdFromStageId(req, res) {
    const stageId = req.params.stageId || req.query.stageId;
    if (!stageId) {
      res.status(400).json({ error: 'stageId is required' });
      return null;
    }

    const Stage = defineStage(sequelize, DataTypes);
    const stage = await Stage.findByPk(stageId);
    const projectId = stage && stage.projectId;
    if (!projectId) {
      res.status(404).send('failed to find projectId');
      return null;
    }

    return projectId;
  }

  /**
   * The role this member plays on a project, as a memberRoles uid. The owner
   * answers 'manager': they hold every authority a manager holds. Null when the
   * user is a stranger to the project.
   */
  async function getProjectRole(projectId, userId) {
    const Project = defineProject(sequelize, DataTypes);
    const project = await Project.findByPk(projectId);
    if (!project) {
      return null;
    }
    if (project.userId === userId) {
      return 'manager';
    }

    const Member = defineMember(sequelize, DataTypes);
    const member = await Member.findOne({ where: { userId: userId, projectId: projectId } });
    if (!member) {
      return null;
    }

    return memberRoles[member.role] ? memberRoles[member.role].uid : null;
  }

  async function isReporter(projectId, userId) {
    const Project = defineProject(sequelize, DataTypes);
    const Member = defineMember(sequelize, DataTypes);
    Project.hasMany(Member, { foreignKey: 'projectId' });
    Member.belongsTo(Project, { foreignKey: 'projectId' });

    const project = await Project.findOne({
      where: { id: projectId },
      include: [
        {
          model: Member,
          where: { userId: userId },
          required: false,
        },
      ],
    });
    if (!project) {
      return false;
    }

    // owner has reporter or higher authority
    if (project.userId === userId) {
      return true;
    }

    const member = project.Members && project.Members[0];
    if (member) {
      const managerRoleIndex = memberRoles.findIndex((entry) => entry.uid === 'manager');
      const developerRoleIndex = memberRoles.findIndex((entry) => entry.uid === 'developer');
      const reporterRoleIndex = memberRoles.findIndex((entry) => entry.uid === 'reporter');
      if (member.role === managerRoleIndex || member.role === developerRoleIndex || member.role === reporterRoleIndex) {
        return true;
      }
    }

    return false;
  }

  return {
    verifyProjectOwner,
    getProjectRole,
    verifyProjectManagerFromProjectId,
    verifyProjectManagerFromRunId,
    verifyProjectManagerFromStageId,
    verifyProjectDeveloperFromProjectId,
    verifyProjectDeveloperFromFolderId,
    verifyProjectDeveloperFromCaseId,
    verifyProjectReporterFromProjectId,
    verifyProjectReporterFromRunId,
    verifyProjectReporterFromCommentableId,
    verifyProjectReporterFromRunCaseId,
    verifyProjectReporterFromStageId,
  };
}
