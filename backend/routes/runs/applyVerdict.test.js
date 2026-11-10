import { describe, it, expect, beforeEach } from 'vitest';
import { Sequelize, DataTypes } from 'sequelize';
import defineProject from '../../models/projects.js';
import defineUser from '../../models/users.js';
import defineRun from '../../models/runs.js';
import defineRunCase from '../../models/runCases.js';
import defineRunCaseVerdict from '../../models/runCaseVerdicts.js';
import { applyVerdict } from './applyVerdict.js';

const UNTESTED = 0;
const PASSED = 1;
const FAILED = 2;
const RETEST = 3;

const ANNE = 11;
const BRUNO = 12;

let sequelize;
let RunCase;
let RunCaseVerdict;

beforeEach(async () => {
  sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  defineProject(sequelize, DataTypes);
  defineUser(sequelize, DataTypes);
  defineRun(sequelize, DataTypes);
  RunCase = defineRunCase(sequelize, DataTypes);
  RunCaseVerdict = defineRunCaseVerdict(sequelize, DataTypes);
  // La cascade est une contrainte de base : sans association déclarée des deux
  // côtés, `sync()` crée la table sans clé étrangère et le test passerait à
  // côté de ce que la migration pose réellement.
  RunCase.hasMany(RunCaseVerdict, { foreignKey: 'runCaseId', onDelete: 'CASCADE' });
  RunCaseVerdict.belongsTo(RunCase, { foreignKey: 'runCaseId', onDelete: 'CASCADE' });
  await sequelize.sync();
  // models/runs.js vise une table « project » qu'aucune migration n'a créée ;
  // sync() recopie la coquille dans le schéma.
  await sequelize.query('PRAGMA foreign_keys = OFF');
});

const addRunCase = () => RunCase.create({ runId: 1, caseId: 1, status: UNTESTED });

const verdictsOf = async (runCaseId) =>
  (await RunCaseVerdict.findAll({ where: { runCaseId }, order: [['userId', 'ASC']] })).map((verdict) => ({
    userId: verdict.userId,
    status: verdict.status,
  }));

const statusOf = async (runCaseId) => (await RunCase.findByPk(runCaseId)).status;

describe('applyVerdict', () => {
  it('pose un avis et le reporte sur le statut du cas', async () => {
    const runCase = await addRunCase();

    const aggregate = await applyVerdict(sequelize, { runCaseId: runCase.id, userId: ANNE, status: PASSED });

    expect(aggregate).toBe(PASSED);
    expect(await statusOf(runCase.id)).toBe(PASSED);
    expect(await verdictsOf(runCase.id)).toEqual([{ userId: ANNE, status: PASSED }]);
  });

  it('remplace son propre avis au lieu d’en ajouter un second', async () => {
    const runCase = await addRunCase();

    await applyVerdict(sequelize, { runCaseId: runCase.id, userId: ANNE, status: PASSED });
    await applyVerdict(sequelize, { runCaseId: runCase.id, userId: ANNE, status: FAILED });

    expect(await verdictsOf(runCase.id)).toEqual([{ userId: ANNE, status: FAILED }]);
    expect(await statusOf(runCase.id)).toBe(FAILED);
  });

  it('garde les deux avis quand deux personnes se prononcent', async () => {
    const runCase = await addRunCase();

    await applyVerdict(sequelize, { runCaseId: runCase.id, userId: ANNE, status: PASSED });
    await applyVerdict(sequelize, { runCaseId: runCase.id, userId: BRUNO, status: PASSED });

    expect(await verdictsOf(runCase.id)).toEqual([
      { userId: ANNE, status: PASSED },
      { userId: BRUNO, status: PASSED },
    ]);
  });

  it('laisse l’échec de l’un l’emporter sur la réussite de l’autre', async () => {
    const runCase = await addRunCase();

    await applyVerdict(sequelize, { runCaseId: runCase.id, userId: ANNE, status: PASSED });
    await applyVerdict(sequelize, { runCaseId: runCase.id, userId: BRUNO, status: FAILED });

    expect(await statusOf(runCase.id)).toBe(FAILED);
  });

  it('retire l’avis quand on repasse le cas en non testé', async () => {
    const runCase = await addRunCase();
    await applyVerdict(sequelize, { runCaseId: runCase.id, userId: ANNE, status: PASSED });

    await applyVerdict(sequelize, { runCaseId: runCase.id, userId: ANNE, status: UNTESTED });

    expect(await verdictsOf(runCase.id)).toEqual([]);
    expect(await statusOf(runCase.id)).toBe(UNTESTED);
  });

  it('rend la main à l’avis restant quand l’un des deux se retire', async () => {
    const runCase = await addRunCase();
    await applyVerdict(sequelize, { runCaseId: runCase.id, userId: ANNE, status: FAILED });
    await applyVerdict(sequelize, { runCaseId: runCase.id, userId: BRUNO, status: RETEST });

    await applyVerdict(sequelize, { runCaseId: runCase.id, userId: ANNE, status: UNTESTED });

    expect(await verdictsOf(runCase.id)).toEqual([{ userId: BRUNO, status: RETEST }]);
    expect(await statusOf(runCase.id)).toBe(RETEST);
  });

  it('emporte les avis quand le cas quitte la campagne', async () => {
    const runCase = await addRunCase();
    await applyVerdict(sequelize, { runCaseId: runCase.id, userId: ANNE, status: PASSED });

    await sequelize.query('PRAGMA foreign_keys = ON');
    await RunCase.destroy({ where: { id: runCase.id } });

    expect(await verdictsOf(runCase.id)).toEqual([]);
  });
});
