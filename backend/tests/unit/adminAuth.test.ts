import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

vi.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:5173',
    JWT_SECRET: 'test-jwt-secret-key-at-least-16-chars',
    ADMIN_EMAIL: 'admin@gmail.com',
    ADMIN_PASSWORD: 'test-admin-password',
    ADMIN_EMAILS: '',
    LOG_LEVEL: 'silent',
  },
}));

vi.mock('../../src/config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/services/reconciler', () => ({
  reconcile: vi.fn(),
}));

vi.mock('../../src/queue/bullBoard', () => ({
  createBullBoard: () => ({
    getRouter: () => {
      const r = express.Router();
      r.get('/', (_req, res) => res.status(200).send('BullBoard OK'));
      return r;
    },
  }),
}));

import { adminRouter } from '../../src/modules/admin/admin.router';

describe('admin auth & /admin/queues', () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/admin', adminRouter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated access to /admin/queues', async () => {
    const res = await request(app).get('/admin/queues');
    expect(res.status).toBe(401);
  });

  it('rejects invalid admin credentials on POST /admin/login', async () => {
    const res = await request(app)
      .post('/admin/login')
      .send({ email: 'user@gmail.com', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('sets admin_token cookie on valid admin@gmail.com login and grants /admin/queues access', async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post('/admin/login')
      .send({ email: 'admin@gmail.com', password: 'test-admin-password' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toEqual({ ok: true, redirectUrl: '/admin/queues' });
    expect(loginRes.headers['set-cookie']?.[0]).toContain('admin_token=');

    const queuesRes = await agent.get('/admin/queues');
    expect(queuesRes.status).toBe(200);
    expect(queuesRes.text).toBe('BullBoard OK');

    const logoutRes = await agent.post('/admin/logout');
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toEqual({ ok: true, loginUrl: 'http://localhost:5173/login' });

    const afterLogoutRes = await agent.get('/admin/queues');
    expect(afterLogoutRes.status).toBe(401);
  });
});
