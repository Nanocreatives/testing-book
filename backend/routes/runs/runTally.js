import { DataTypes, Op } from 'sequelize';
import defineCase from '../../models/cases.js';
import defineMember from '../../models/members.js';
import defineRunCase from '../../models/runCases.js';
import defineRunCaseVerdict from '../../models/runCaseVerdicts.js';
import { tallyRun } from './verdictAggregate.js';

/**
 * How many project members may weigh in on a case owned by `ownerRole`.
 *
 * Same rule as the case gate: a case belongs to a role, or to everyone when it
 * names none. Capping the expected verdicts by this count is what stops a case
 * reserved for the developers from waiting forever on a project with one.
 */
function countEligible(memberRoles, ownerRole) {
  if (ownerRole === null || ownerRole === undefined) {
    return memberRoles.length;
  }
  return memberRoles.filter((role) => role === ownerRole).length;
}

/**
 * The tally a run's chart and reports read.
 *
 * Four separate queries rather than nested includes: joining cases to their
 * verdicts and their folders in one go multiplies the rows, and the count comes
 * out wrong in a way nobody notices.
 */
export async function buildRunTally(sequelize, projectId, runId) {
  const Case = defineCase(sequelize, DataTypes);
  const Member = defineMember(sequelize, DataTypes);
  const RunCase = defineRunCase(sequelize, DataTypes);
  const RunCaseVerdict = defineRunCaseVerdict(sequelize, DataTypes);

  const runCases = await RunCase.findAll({
    where: { runId: runId },
    attributes: ['id', 'caseId'],
  });

  if (runCases.length === 0) {
    return { statusCounts: [], disagreeing: 0, awaitingVerdicts: 0 };
  }

  const [cases, verdicts, members] = await Promise.all([
    Case.findAll({
      where: { id: { [Op.in]: runCases.map((runCase) => runCase.caseId) } },
      attributes: ['id', 'ownerRole', 'verdictsExpected'],
    }),
    RunCaseVerdict.findAll({
      where: { runCaseId: { [Op.in]: runCases.map((runCase) => runCase.id) } },
      attributes: ['runCaseId', 'status'],
    }),
    Member.findAll({ where: { projectId: projectId }, attributes: ['role'] }),
  ]);

  const caseById = new Map(cases.map((entry) => [entry.id, entry]));
  const memberRoles = members.map((member) => member.role);

  const statusesByRunCase = new Map();
  for (const verdict of verdicts) {
    const bucket = statusesByRunCase.get(verdict.runCaseId) ?? [];
    bucket.push(verdict.status);
    statusesByRunCase.set(verdict.runCaseId, bucket);
  }

  return tallyRun(
    runCases.map((runCase) => {
      const testCase = caseById.get(runCase.caseId);
      return {
        statuses: statusesByRunCase.get(runCase.id) ?? [],
        expected: testCase?.verdictsExpected ?? 1,
        eligibleCount: countEligible(memberRoles, testCase?.ownerRole ?? null),
      };
    })
  );
}
