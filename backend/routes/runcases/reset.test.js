import { describe, it, expect, beforeEach } from 'vitest';
import { Sequelize, DataTypes } from 'sequelize';
import { applyVerdict } from '../runs/applyVerdict.js';
import defineProject from '../../models/projects.js';
import defineUser from '../../models/users.js';
import defineRun from '../../models/runs.js';
import defineRunCase from '../../models/runCases.js';
import defineRunCaseVerdict from '../../models/runCaseVerdicts.js';

const PASSED = 1;
const ANNE = 11;
const GESTIONNAIRE = 1;

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
  RunCase.hasMany(RunCaseVerdict, { foreignKey: 'runCaseId', onDelete: 'CASCADE' });
  RunCaseVerdict.belongsTo(RunCase, { foreignKey: 'runCaseId', onDelete: 'CASCADE' });
  await sequelize.sync();
  await sequelize.query('PRAGMA foreign_keys = OFF');
});

/** Ce que fait la route, sans la couche HTTP. */
const remettreAFaire = async (ids) => {
  await RunCaseVerdict.destroy({ where: { runCaseId: ids } });
  await RunCase.update({ status: 0 }, { where: { id: ids } });
};

describe('remettre un cas à faire', () => {
  it('efface l’avis d’autrui, ce que la liste déroulante ne sait pas faire', async () => {
    const runCase = await RunCase.create({ runId: 1, caseId: 1, status: 0 });
    await applyVerdict(sequelize, { runCaseId: runCase.id, userId: ANNE, status: PASSED });

    // Le gestionnaire choisit « Non testé » : il ne retire que SON avis, donc rien.
    await applyVerdict(sequelize, { runCaseId: runCase.id, userId: GESTIONNAIRE, status: 0 });
    expect((await RunCase.findByPk(runCase.id)).status).toBe(PASSED);

    // Le bouton de remise à faire, lui, efface tout.
    await remettreAFaire([runCase.id]);
    expect((await RunCase.findByPk(runCase.id)).status).toBe(0);
    expect(await RunCaseVerdict.count({ where: { runCaseId: runCase.id } })).toBe(0);
  });

  it('ne touche pas les autres cas', async () => {
    const premier = await RunCase.create({ runId: 1, caseId: 1, status: 0 });
    const second = await RunCase.create({ runId: 1, caseId: 2, status: 0 });
    await applyVerdict(sequelize, { runCaseId: premier.id, userId: ANNE, status: PASSED });
    await applyVerdict(sequelize, { runCaseId: second.id, userId: ANNE, status: PASSED });

    await remettreAFaire([premier.id]);

    expect((await RunCase.findByPk(second.id)).status).toBe(PASSED);
    expect(await RunCaseVerdict.count({ where: { runCaseId: second.id } })).toBe(1);
  });
});
