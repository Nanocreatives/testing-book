import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Sequelize } from 'sequelize';
import casesRoleRoute from './role.js';

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
    verifyProjectDeveloperFromProjectId: vi.fn((req, res, next) => next()),
  }),
}));

const mockCase = { update: vi.fn() };
vi.mock('../../models/cases.js', () => ({ default: () => mockCase }));

const mockFolder = { findAll: vi.fn() };
vi.mock('../../models/folders.js', () => ({ default: () => mockFolder }));

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/cases', casesRoleRoute(new Sequelize({ dialect: 'sqlite', logging: false })));
  return app;
}

describe('bulk case role', () => {
  let app;

  beforeEach(() => {
    app = makeApp();
    vi.clearAllMocks();
    mockFolder.findAll.mockResolvedValue([{ id: 10 }, { id: 11 }]);
    mockCase.update.mockResolvedValue([2]);
  });

  it('assigns a role to the cases given', async () => {
    const res = await request(app)
      .put('/cases/role?projectId=1')
      .send({ caseIds: [4, 5], ownerRole: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: 2 });
    expect(mockCase.update).toHaveBeenCalledWith({ ownerRole: 1 }, expect.anything());
  });

  it('accepts handing a case back to everyone', async () => {
    const res = await request(app)
      .put('/cases/role?projectId=1')
      .send({ caseIds: [4], ownerRole: null });

    expect(res.status).toBe(200);
    expect(mockCase.update).toHaveBeenCalledWith({ ownerRole: null }, expect.anything());
  });

  it('refuses a role that does not exist', async () => {
    const res = await request(app)
      .put('/cases/role?projectId=1')
      .send({ caseIds: [4], ownerRole: 9 });

    expect(res.status).toBe(400);
    expect(mockCase.update).not.toHaveBeenCalled();
  });

  it('refuses an empty list', async () => {
    const res = await request(app).put('/cases/role?projectId=1').send({ caseIds: [], ownerRole: 1 });

    expect(res.status).toBe(400);
    expect(mockCase.update).not.toHaveBeenCalled();
  });

  it('only touches cases that live in the project', async () => {
    await request(app)
      .put('/cases/role?projectId=1')
      .send({ caseIds: [4], ownerRole: 1 });

    const [, options] = mockCase.update.mock.calls[0];
    expect(options.where.folderId).toBeDefined();
  });
});
