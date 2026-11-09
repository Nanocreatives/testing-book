import { DataTypes, Op } from 'sequelize';
import { memberRoles } from '../users/authSettings.js';
import defineCase from '../../models/cases.js';
import defineFolder from '../../models/folders.js';
import defineRunCase from '../../models/runCases.js';

const UNTESTED_STATUS = 0;

export const roleIndex = (uid) => memberRoles.findIndex((entry) => entry.uid === uid);

/**
 * The run's cases in the order they are meant to be played, with who owns each
 * and where it stands. Separate queries on purpose: joining cases to their
 * folders and to their statuses in one include multiplies the rows.
 */
export async function fetchRunOrder(sequelize, projectId, runId) {
  const Case = defineCase(sequelize, DataTypes);
  const Folder = defineFolder(sequelize, DataTypes);
  const RunCase = defineRunCase(sequelize, DataTypes);

  const folders = await Folder.findAll({ where: { projectId: projectId }, attributes: ['id'] });
  const folderIds = folders.map((folder) => folder.id);
  if (folderIds.length === 0) {
    return [];
  }

  const cases = await Case.findAll({
    where: { folderId: { [Op.in]: folderIds } },
    attributes: ['id', 'title', 'ownerRole'],
    order: [['id', 'ASC']],
  });

  const runCases = await RunCase.findAll({ where: { runId: runId }, attributes: ['caseId', 'status'] });
  const statusOf = new Map(runCases.map((runCase) => [runCase.caseId, runCase.status]));

  // A case left out of the run is not part of its order and blocks nothing.
  return cases
    .filter((testCase) => statusOf.has(testCase.id))
    .map((testCase) => ({
      id: testCase.id,
      title: testCase.title,
      ownerRole: testCase.ownerRole ?? null,
      status: statusOf.get(testCase.id),
    }));
}

/**
 * What stands between one role and its share of the run.
 *
 * A case owned by someone else and left untested stops everything of ours that
 * comes after it: it is the prerequisite the rest leans on. Cases of the same
 * owner never block each other — within their own share, people pick their own
 * order. An unowned case belongs to everyone and blocks no one.
 */
export function gateFor(order, viewerRole) {
  const isTheirs = (entry) => entry.ownerRole === null || entry.ownerRole === viewerRole;

  const blockedCaseIds = [];
  let waitingOn = 0;
  for (const entry of order) {
    if (!isTheirs(entry)) {
      if (entry.status === UNTESTED_STATUS) {
        waitingOn += 1;
      }
      continue;
    }
    if (waitingOn > 0) {
      blockedCaseIds.push(entry.id);
    }
  }

  // Only the ones that actually hold something back: an untested case owned by
  // someone else, with at least one of ours still to come after it.
  const blocking = [];
  let ownAhead = false;
  for (let index = order.length - 1; index >= 0; index -= 1) {
    const entry = order[index];
    if (isTheirs(entry)) {
      ownAhead = true;
      continue;
    }
    if (ownAhead && entry.status === UNTESTED_STATUS) {
      blocking.unshift({ id: entry.id, title: entry.title, ownerRole: entry.ownerRole });
    }
  }

  return { blocking, blockedCaseIds };
}
