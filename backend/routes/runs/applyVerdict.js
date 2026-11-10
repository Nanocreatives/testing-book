import { DataTypes } from 'sequelize';
import defineRunCase from '../../models/runCases.js';
import defineRunCaseVerdict from '../../models/runCaseVerdicts.js';
import { aggregateStatus } from './verdictAggregate.js';

const UNTESTED = 0;

/**
 * Records one person's verdict on a case of a run, then rewrites the case's
 * aggregate status from every verdict it now holds.
 *
 * Setting a case back to untested REMOVES that person's verdict instead of
 * storing a zero: a withdrawn opinion is an absence, and keeping it would make
 * the case look played by one more person than it was.
 */
export async function applyVerdict(sequelize, { runCaseId, userId, status, transaction }) {
  const RunCase = defineRunCase(sequelize, DataTypes);
  const RunCaseVerdict = defineRunCaseVerdict(sequelize, DataTypes);

  if (status === UNTESTED) {
    await RunCaseVerdict.destroy({ where: { runCaseId, userId }, transaction });
  } else {
    const existing = await RunCaseVerdict.findOne({ where: { runCaseId, userId }, transaction });
    if (existing) {
      await RunCaseVerdict.update({ status }, { where: { id: existing.id }, transaction });
    } else {
      await RunCaseVerdict.create({ runCaseId, userId, status }, { transaction });
    }
  }

  const verdicts = await RunCaseVerdict.findAll({
    where: { runCaseId },
    attributes: ['status'],
    transaction,
  });

  const aggregate = aggregateStatus(verdicts.map((verdict) => verdict.status)) ?? UNTESTED;
  await RunCase.update({ status: aggregate }, { where: { id: runCaseId }, transaction });

  return aggregate;
}
