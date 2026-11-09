import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Sequelize } from 'sequelize';
import runsNewRoute from './new.js';
import runsEditRoute from './edit.js';

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
    verifyProjectReporterFromProjectId: vi.fn((req, res, next) => next()),
    verifyProjectReporterFromRunId: vi.fn((req, res, next) => next()),
  }),
}));

// ── model mocks ──────────────────────────────────────────────────────────────
const mockRun = {
  create: vi.fn(),
  findByPk: vi.fn(),
};

vi.mock('../../models/runs.js', () => ({
  default: () => mockRun,
}));

// ── helpers ──────────────────────────────────────────────────────────────────
function makeApp() {
  const app = express();
  app.use(express.json());
  const sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
  app.use('/runs', runsNewRoute(sequelize));
  app.use('/runs', runsEditRoute(sequelize));
  return app;
}

// ── tests ────────────────────────────────────────────────────────────────────
describe('test run instructions', () => {
  let app;

  beforeEach(() => {
    app = makeApp();
    vi.clearAllMocks();
  });

  it('stores the instructions given when a run is created', async () => {
    const instructions = 'Play the waves in order.\nA case is passed only if it was seen.';
    mockRun.create.mockResolvedValue({ id: 1, name: 'Wave 0', instructions });

    const res = await request(app)
      .post('/runs?projectId=10')
      .send({ name: 'Wave 0', description: '', state: 0, instructions });

    expect(res.status).toBe(200);
    expect(mockRun.create).toHaveBeenCalledWith(expect.objectContaining({ instructions }));
    expect(res.body.instructions).toBe(instructions);
  });

  it('leaves instructions undefined when none are given', async () => {
    mockRun.create.mockResolvedValue({ id: 2, name: 'Wave 1' });

    const res = await request(app).post('/runs?projectId=10').send({ name: 'Wave 1', state: 0 });

    expect(res.status).toBe(200);
    expect(mockRun.create).toHaveBeenCalledWith(expect.objectContaining({ instructions: undefined }));
  });

  it('still requires a name', async () => {
    const res = await request(app).post('/runs?projectId=10').send({ instructions: 'something' });

    expect(res.status).toBe(400);
    expect(mockRun.create).not.toHaveBeenCalled();
  });

  it('updates the instructions of an existing run', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    mockRun.findByPk.mockResolvedValue({ id: 1, name: 'Wave 0', update });

    const res = await request(app).put('/runs/1').send({ name: 'Wave 0', instructions: 'Revised guidance' });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ instructions: 'Revised guidance' }));
  });

  it('accepts clearing the instructions', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    mockRun.findByPk.mockResolvedValue({ id: 1, name: 'Wave 0', update });

    const res = await request(app).put('/runs/1').send({ name: 'Wave 0', instructions: '' });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ instructions: '' }));
  });
});
