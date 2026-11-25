import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:5173',
    JWT_SECRET: 'test-jwt-secret-key-at-least-16-chars',
    SLACK_CLIENT_ID: 'slack-client-id',
    SLACK_CLIENT_SECRET: 'slack-client-secret',
    SLACK_REDIRECT_URI: 'https://example.trycloudflare.com/auth/slack/callback',
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

vi.mock('../../src/middleware/auth', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user: { userId: string } }).user = { userId: 'user-123' };
    next();
  },
}));

const mockUpsert = vi.fn();
vi.mock('../../src/db/prisma', () => ({
  prisma: {
    slackConnection: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

vi.mock('../../src/services/crypto', () => ({
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => v.replace(/^enc:/, ''),
}));

import { slackRouter } from '../../src/modules/slack/slack.router';

describe('Slack OAuth cross-domain callback', () => {
  const app = express();
  app.use('/auth', slackRouter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('authenticates /auth/slack/callback via signed state JWT without requiring localhost cookies', async () => {
    const startRes = await request(app).get('/auth/slack');
    expect(startRes.status).toBe(302);

    const authUrl = new URL(startRes.headers.location);
    const state = authUrl.searchParams.get('state')!;
    expect(state).toBeTruthy();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          ok: true,
          team: { id: 'T1', name: 'Test Team' },
          incoming_webhook: { channel_id: 'C1', url: 'https://hooks.slack.com/services/T1/B1/X1' },
          access_token: 'xoxb-123',
        }),
      })
    );

    const cbRes = await request(app).get(`/auth/slack/callback?code=code-1&state=${encodeURIComponent(state)}`);

    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.location).toBe('http://localhost:5173/dashboard?slack_connected=true');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-123' },
      })
    );

    vi.unstubAllGlobals();
  });

  it('redirects with slack_error=invalid_state when state is invalid', async () => {
    const cbRes = await request(app).get('/auth/slack/callback?code=code-1&state=tampered');
    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.location).toBe('http://localhost:5173/dashboard?slack_error=invalid_state');
  });
});
