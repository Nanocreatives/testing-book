import { DataTypes, Op } from 'sequelize';
import defineStage from '../../models/stages.js';
import defineStageCompletion from '../../models/stageCompletions.js';
import defineRun from '../../models/runs.js';
import defineRunCase from '../../models/runCases.js';

export const BRIEFING_KIND = 0;
export const RUN_KIND = 1;

const UNTESTED_STATUS = 0;

/**
 * Read the project's path as one user sees it: every stage in order, whether
 * they are done with it, and whether the stages before it still block them.
 *
 * Counts come from separate queries on purpose. Joining runs and their cases in
 * one include multiplies the rows, and this runs on every page load.
 */
export async function buildPath(sequelize, projectId, userId) {
  const Stage = defineStage(sequelize, DataTypes);
  const StageCompletion = defineStageCompletion(sequelize, DataTypes);
  const Run = defineRun(sequelize, DataTypes);
  const RunCase = defineRunCase(sequelize, DataTypes);

  const stages = await Stage.findAll({
    where: { projectId: projectId },
    order: [
      ['position', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  if (stages.length === 0) {
    return [];
  }

  const runIds = stages.filter((stage) => stage.runId).map((stage) => stage.runId);

  const runs = runIds.length
    ? await Run.findAll({ where: { id: { [Op.in]: runIds } }, attributes: ['id', 'name'] })
    : [];
  const runNames = new Map(runs.map((run) => [run.id, run.name]));

  const totals = runIds.length ? await RunCase.count({ where: { runId: { [Op.in]: runIds } }, group: ['runId'] }) : [];
  const settled = runIds.length
    ? await RunCase.count({
        where: { runId: { [Op.in]: runIds }, status: { [Op.ne]: UNTESTED_STATUS } },
        group: ['runId'],
      })
    : [];
  const caseTotals = new Map(totals.map((row) => [row.runId, row.count]));
  const caseSettled = new Map(settled.map((row) => [row.runId, row.count]));

  const completions = await StageCompletion.findAll({
    where: { stageId: { [Op.in]: stages.map((stage) => stage.id) }, userId: userId },
    attributes: ['stageId'],
  });
  const acknowledged = new Set(completions.map((completion) => completion.stageId));

  let blocked = false;
  return stages.map((stage) => {
    const total = stage.runId ? (caseTotals.get(stage.runId) ?? 0) : 0;
    const done = stage.runId ? (caseSettled.get(stage.runId) ?? 0) : 0;
    const isDone = stage.kind === RUN_KIND ? total > 0 && done === total : acknowledged.has(stage.id);

    const entry = {
      id: stage.id,
      projectId: stage.projectId,
      position: stage.position,
      kind: stage.kind,
      title: stage.title,
      content: stage.content,
      runId: stage.runId,
      runName: stage.runId ? (runNames.get(stage.runId) ?? null) : null,
      caseTotal: stage.kind === RUN_KIND ? total : null,
      caseSettled: stage.kind === RUN_KIND ? done : null,
      isDone: isDone,
      isLocked: blocked,
    };

    blocked = blocked || !isDone;
    return entry;
  });
}
