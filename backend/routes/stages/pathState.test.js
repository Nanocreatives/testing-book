import { describe, it, expect, beforeEach } from 'vitest';
import { Sequelize, DataTypes } from 'sequelize';
import { buildPath, BRIEFING_KIND, RUN_KIND } from './pathState.js';
import defineProject from '../../models/projects.js';
import defineUser from '../../models/users.js';
import defineRun from '../../models/runs.js';
import defineRunCase from '../../models/runCases.js';
import defineStage from '../../models/stages.js';
import defineStageCompletion from '../../models/stageCompletions.js';

const UNTESTED = 0;
const PASSED = 1;
const READER_ID = 7;
const OTHER_READER_ID = 8;

let sequelize;
let Run;
let RunCase;
let Stage;
let StageCompletion;

beforeEach(async () => {
  sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  defineProject(sequelize, DataTypes);
  defineUser(sequelize, DataTypes);
  Run = defineRun(sequelize, DataTypes);
  RunCase = defineRunCase(sequelize, DataTypes);
  Stage = defineStage(sequelize, DataTypes);
  StageCompletion = defineStageCompletion(sequelize, DataTypes);
  await sequelize.sync();
  // models/runs.js points its projectId at a table named "project", which no
  // migration ever created; sync() copies that typo into the schema.
  await sequelize.query('PRAGMA foreign_keys = OFF');
});

async function addRun(name) {
  return Run.create({ name, projectId: 1, state: 0 });
}

async function addCases(runId, statuses) {
  await RunCase.bulkCreate(statuses.map((status, index) => ({ runId, caseId: index + 1, status })));
}

describe('buildPath', () => {
  it('returns nothing when the project has no path', async () => {
    expect(await buildPath(sequelize, 1, READER_ID)).toEqual([]);
  });

  it('locks every stage that follows an unread briefing', async () => {
    await Stage.create({ projectId: 1, position: 0, kind: BRIEFING_KIND, title: 'Personas', content: 'Read me' });
    const run = await addRun('Wave 0');
    await addCases(run.id, [UNTESTED]);
    await Stage.create({ projectId: 1, position: 1, kind: RUN_KIND, title: 'Wave 0', runId: run.id });

    const path = await buildPath(sequelize, 1, READER_ID);

    expect(path.map((stage) => [stage.title, stage.isDone, stage.isLocked])).toEqual([
      ['Personas', false, false],
      ['Wave 0', false, true],
    ]);
  });

  it('unlocks the next stage once the briefing is acknowledged', async () => {
    const briefing = await Stage.create({ projectId: 1, position: 0, kind: BRIEFING_KIND, title: 'Personas' });
    const run = await addRun('Wave 0');
    await addCases(run.id, [UNTESTED]);
    await Stage.create({ projectId: 1, position: 1, kind: RUN_KIND, title: 'Wave 0', runId: run.id });
    await StageCompletion.create({ stageId: briefing.id, userId: READER_ID });

    const path = await buildPath(sequelize, 1, READER_ID);

    expect(path[0].isDone).toBe(true);
    expect(path[1].isLocked).toBe(false);
  });

  it('keeps one reader’s acknowledgement to themselves', async () => {
    const briefing = await Stage.create({ projectId: 1, position: 0, kind: BRIEFING_KIND, title: 'Personas' });
    await StageCompletion.create({ stageId: briefing.id, userId: OTHER_READER_ID });

    const path = await buildPath(sequelize, 1, READER_ID);

    expect(path[0].isDone).toBe(false);
  });

  it('counts a run stage as done only when no case is left untested', async () => {
    const run = await addRun('Wave 0');
    await addCases(run.id, [PASSED, PASSED, UNTESTED]);
    await Stage.create({ projectId: 1, position: 0, kind: RUN_KIND, title: 'Wave 0', runId: run.id });
    const next = await Stage.create({ projectId: 1, position: 1, kind: BRIEFING_KIND, title: 'Debrief' });

    let path = await buildPath(sequelize, 1, READER_ID);
    expect(path[0]).toMatchObject({ caseTotal: 3, caseSettled: 2, isDone: false });
    expect(path[1].isLocked).toBe(true);

    await RunCase.update({ status: PASSED }, { where: { runId: run.id } });

    path = await buildPath(sequelize, 1, READER_ID);
    expect(path[0]).toMatchObject({ caseTotal: 3, caseSettled: 3, isDone: true });
    expect(path[1].id).toBe(next.id);
    expect(path[1].isLocked).toBe(false);
  });

  it('does not count an empty run as done', async () => {
    const run = await addRun('Wave 0');
    await Stage.create({ projectId: 1, position: 0, kind: RUN_KIND, title: 'Wave 0', runId: run.id });

    const path = await buildPath(sequelize, 1, READER_ID);

    expect(path[0]).toMatchObject({ caseTotal: 0, isDone: false });
  });

  it('reads the path in the order the manager set, not the order of creation', async () => {
    await Stage.create({ projectId: 1, position: 2, kind: BRIEFING_KIND, title: 'Third' });
    await Stage.create({ projectId: 1, position: 0, kind: BRIEFING_KIND, title: 'First' });
    await Stage.create({ projectId: 1, position: 1, kind: BRIEFING_KIND, title: 'Second' });

    const path = await buildPath(sequelize, 1, READER_ID);

    expect(path.map((stage) => stage.title)).toEqual(['First', 'Second', 'Third']);
  });

  it('ignores the stages of another project', async () => {
    await Stage.create({ projectId: 2, position: 0, kind: BRIEFING_KIND, title: 'Elsewhere' });

    expect(await buildPath(sequelize, 1, READER_ID)).toEqual([]);
  });

  it('names the run a stage points at', async () => {
    const run = await addRun('Wave 0');
    await addCases(run.id, [PASSED]);
    await Stage.create({ projectId: 1, position: 0, kind: RUN_KIND, title: 'Play wave 0', runId: run.id });

    const path = await buildPath(sequelize, 1, READER_ID);

    expect(path[0].runName).toBe('Wave 0');
  });
});
