import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Sequelize } from 'sequelize';
import stagesNewRoute from './new.js';
import stagesReorderRoute from './reorder.js';
import stagesCompleteRoute from './complete.js';
import { BRIEFING_KIND, RUN_KIND } from './pathState.js';

// ── auth / permission mocks ──────────────────────────────────────────────────
vi.mock('../../middleware/auth.js', () => ({
  default: () => ({
    verifySignedIn: vi.fn((req, res, next) => {
      req.userId = 1;
      next();
    }),
  }),
}));

vi.mock('../../middleware/verifyEditable.js', () => ({
  default: () => ({
    verifyProjectManagerFromProjectId: vi.fn((req, res, next) => next()),
    verifyProjectManagerFromStageId: vi.fn((req, res, next) => next()),
    verifyProjectReporterFromStageId: vi.fn((req, res, next) => next()),
  }),
}));

// ── model mocks ──────────────────────────────────────────────────────────────
const mockStage = {
  create: vi.fn(),
  findByPk: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  max: vi.fn(),
};

vi.mock('../../models/stages.js', () => ({
  default: () => mockStage,
}));

const mockStageCompletion = {
  findOrCreate: vi.fn(),
};

vi.mock('../../models/stageCompletions.js', () => ({
  default: () => mockStageCompletion,
}));

// ── helpers ──────────────────────────────────────────────────────────────────
function makeApp() {
  const app = express();
  app.use(express.json());
  const sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
  sequelize.transaction = async (callback) => callback('transaction');
  app.use('/stages', stagesNewRoute(sequelize));
  app.use('/stages', stagesReorderRoute(sequelize));
  app.use('/stages', stagesCompleteRoute(sequelize));
  return app;
}

// ── tests ────────────────────────────────────────────────────────────────────
describe('stage routes', () => {
  let app;

  beforeEach(() => {
    app = makeApp();
    vi.clearAllMocks();
  });

  it('appends a new stage after the last one', async () => {
    mockStage.max.mockResolvedValue(4);
    mockStage.create.mockResolvedValue({ id: 9 });

    const res = await request(app)
      .post('/stages?projectId=1')
      .send({ kind: BRIEFING_KIND, title: 'Personas', content: 'Read me' });

    expect(res.status).toBe(200);
    expect(mockStage.create).toHaveBeenCalledWith(expect.objectContaining({ position: 5 }));
  });

  it('starts the path at position zero', async () => {
    mockStage.max.mockResolvedValue(null);
    mockStage.create.mockResolvedValue({ id: 1 });

    await request(app).post('/stages?projectId=1').send({ kind: BRIEFING_KIND, title: 'Personas' });

    expect(mockStage.create).toHaveBeenCalledWith(expect.objectContaining({ position: 0 }));
  });

  it('refuses a run stage that points at no run', async () => {
    const res = await request(app).post('/stages?projectId=1').send({ kind: RUN_KIND, title: 'Wave 0' });

    expect(res.status).toBe(400);
    expect(mockStage.create).not.toHaveBeenCalled();
  });

  it('drops the content of a run stage', async () => {
    mockStage.max.mockResolvedValue(null);
    mockStage.create.mockResolvedValue({ id: 1 });

    await request(app)
      .post('/stages?projectId=1')
      .send({ kind: RUN_KIND, title: 'Wave 0', runId: 3, content: 'stray prose' });

    expect(mockStage.create).toHaveBeenCalledWith(expect.objectContaining({ content: null, runId: 3 }));
  });

  it('refuses to reorder on a partial list', async () => {
    mockStage.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const res = await request(app).put('/stages/reorder?projectId=1').send({ stageIds: [1, 2, 3] });

    expect(res.status).toBe(400);
    expect(mockStage.update).not.toHaveBeenCalled();
  });

  it('renumbers the path from the order it is given', async () => {
    mockStage.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    mockStage.update.mockResolvedValue([1]);

    const res = await request(app).put('/stages/reorder?projectId=1').send({ stageIds: [3, 1, 2] });

    expect(res.status).toBe(200);
    expect(mockStage.update).toHaveBeenCalledWith({ position: 0 }, expect.objectContaining({ where: { id: 3 } }));
    expect(mockStage.update).toHaveBeenCalledWith({ position: 2 }, expect.objectContaining({ where: { id: 2 } }));
  });

  it('records that a reporter read a briefing', async () => {
    mockStage.findByPk.mockResolvedValue({ id: 5, kind: BRIEFING_KIND });
    mockStageCompletion.findOrCreate.mockResolvedValue([{ id: 2, stageId: 5, userId: 1 }]);

    const res = await request(app).post('/stages/5/complete');

    expect(res.status).toBe(200);
    expect(mockStageCompletion.findOrCreate).toHaveBeenCalledWith({ where: { stageId: 5, userId: 1 } });
  });

  it('refuses to tick off a run stage by hand', async () => {
    mockStage.findByPk.mockResolvedValue({ id: 6, kind: RUN_KIND });

    const res = await request(app).post('/stages/6/complete');

    expect(res.status).toBe(400);
    expect(mockStageCompletion.findOrCreate).not.toHaveBeenCalled();
  });
});
