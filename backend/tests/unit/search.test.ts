import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../src/config/env', () => ({
  env: {
    ELASTICSEARCH_URL: 'http://localhost:9200',
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
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
    (req as express.Request & { user: { userId: string } }).user = { userId: 'user-1' };
    next();
  },
}));

const mockSearchEmails = vi.fn();
vi.mock('../../src/services/search', async () => {
  const actual = await vi.importActual<typeof import('../../src/services/search')>(
    '../../src/services/search'
  );
  return {
    ...actual,
    searchEmails: (...args: unknown[]) => mockSearchEmails(...args),
  };
});

const mockFindMany = vi.fn();
const mockCount = vi.fn();
vi.mock('../../src/db/prisma', () => ({
  prisma: {
    emailJob: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

import { resolveStatusFilter } from '../../src/services/search';
import { emailsRouter } from '../../src/modules/emails/emails.router';

describe('search service & /api/emails/search', () => {
  const app = express();
  app.use('/api/emails', emailsRouter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveStatusFilter', () => {
    it('maps dashboard tabs to database/ES statuses', () => {
      expect(resolveStatusFilter('scheduled')).toEqual(['SCHEDULED', 'PROCESSING']);
      expect(resolveStatusFilter('sent')).toEqual(['SENT', 'FAILED']);
      expect(resolveStatusFilter('FAILED')).toEqual(['FAILED']);
      expect(resolveStatusFilter(undefined)).toBeUndefined();
      expect(resolveStatusFilter('   ')).toBeUndefined();
    });
  });

  describe('GET /api/emails/search', () => {
    it('maps ES EmailDoc results to EmailJob shape expected by the dashboard', async () => {
      mockSearchEmails.mockResolvedValueOnce({
        items: [
          {
            id: 'job-1',
            userId: 'user-1',
            campaignId: 'camp-1',
            recipient: 'alice@example.com',
            subject: 'Hello Alice',
            body: 'Body text',
            status: 'SCHEDULED',
            senderEmail: 'sender@example.com',
            scheduledAt: '2026-11-25T10:00:00.000Z',
            nextRunAt: '2026-11-25T10:05:00.000Z',
            sentAt: null,
            previewUrl: null,
            error: null,
          },
        ],
        total: 1,
      });

      const res = await request(app).get('/api/emails/search?q=alice&status=scheduled&page=1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        items: [
          {
            id: 'job-1',
            recipientEmail: 'alice@example.com',
            subject: 'Hello Alice',
            body: 'Body text',
            status: 'SCHEDULED',
            scheduledAt: '2026-11-25T10:00:00.000Z',
            nextRunAt: '2026-11-25T10:05:00.000Z',
            sentAt: null,
            previewUrl: null,
            errorMessage: null,
            senderEmail: 'sender@example.com',
            campaignId: 'camp-1',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      });
    });

    it('falls back to Prisma when Elasticsearch is unavailable', async () => {
      mockSearchEmails.mockRejectedValueOnce(new Error('Search service unavailable'));
      const scheduledAt = new Date('2026-11-25T10:00:00.000Z');
      const sentAt = new Date('2026-11-25T10:01:00.000Z');

      mockFindMany.mockResolvedValueOnce([
        {
          id: 'job-2',
          userId: 'user-1',
          campaignId: 'camp-1',
          recipientEmail: 'bob@acme.io',
          subject: 'Follow up',
          body: 'Hi Bob',
          status: 'SENT',
          scheduledAt,
          nextRunAt: scheduledAt,
          sentAt,
          previewUrl: 'https://ethereal.email/message/123',
          errorMessage: null,
          sender: { email: 'sender@example.com' },
        },
      ]);
      mockCount.mockResolvedValueOnce(1);

      const res = await request(app).get('/api/emails/search?q=bob&status=sent&page=1');

      expect(res.status).toBe(200);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            status: { in: ['SENT', 'FAILED'] },
          }),
        })
      );
      expect(res.body.items[0]).toMatchObject({
        id: 'job-2',
        recipientEmail: 'bob@acme.io',
        subject: 'Follow up',
        status: 'SENT',
        previewUrl: 'https://ethereal.email/message/123',
      });
      expect(res.body.total).toBe(1);
    });
  });
});
