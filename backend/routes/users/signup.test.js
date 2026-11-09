import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Sequelize } from 'sequelize';

const mockUser = {
  count: vi.fn(),
  create: vi.fn(),
};

vi.mock('../../models/users.js', () => ({
  default: () => mockUser,
}));

async function makeApp() {
  // Le module de configuration lit l'environnement à son chargement : il faut
  // le relire après chaque changement, sans quoi le drapeau reste figé.
  vi.resetModules();
  const { default: signUpRoute } = await import('./signup.js');
  const app = express();
  app.use(express.json());
  app.use('/users', signUpRoute(new Sequelize({ dialect: 'sqlite', logging: false })));
  return app;
}

describe('sign up switch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SIGNUP_DISABLED;
    mockUser.count.mockResolvedValue(3);
    mockUser.create.mockResolvedValue({ id: 1, email: 'someone@example.com' });
  });

  afterEach(() => {
    delete process.env.SIGNUP_DISABLED;
  });

  it('accepts a sign up when nothing says otherwise', async () => {
    const app = await makeApp();

    const res = await request(app)
      .post('/users/signup')
      .send({ email: 'someone@example.com', password: 'secret', username: 'someone' });

    expect(res.status).toBe(200);
    expect(mockUser.create).toHaveBeenCalled();
  });

  it('refuses a sign up when the instance is closed', async () => {
    process.env.SIGNUP_DISABLED = 'true';
    const app = await makeApp();

    const res = await request(app)
      .post('/users/signup')
      .send({ email: 'someone@example.com', password: 'secret', username: 'someone' });

    expect(res.status).toBe(403);
    expect(mockUser.create).not.toHaveBeenCalled();
  });

  it('only closes on the exact word, never on a stray value', async () => {
    process.env.SIGNUP_DISABLED = 'yes';
    const app = await makeApp();

    const res = await request(app)
      .post('/users/signup')
      .send({ email: 'someone@example.com', password: 'secret', username: 'someone' });

    expect(res.status).toBe(200);
  });

  it('tells the interface the door is open', async () => {
    const app = await makeApp();

    const res = await request(app).get('/users/signup/enabled');

    expect(res.body).toEqual({ enabled: true });
  });

  it('tells the interface the door is closed', async () => {
    process.env.SIGNUP_DISABLED = 'true';
    const app = await makeApp();

    const res = await request(app).get('/users/signup/enabled');

    expect(res.body).toEqual({ enabled: false });
  });
});
