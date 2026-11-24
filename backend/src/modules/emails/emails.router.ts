import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { searchEmails } from '../../services/search';
import { logger } from '../../config/logger';
import type { EmailStatus } from '@prisma/client';

export const emailsRouter = Router();

const listQuerySchema = z.object({
  status: z.enum(['scheduled', 'sent']).default('scheduled'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const searchQuerySchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/emails
emailsRouter.get('/', requireAuth, validate(listQuerySchema, 'query'), async (req, res) => {
  // After validate middleware, req.query has the coerced/validated type
  const { status, page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>;
  const userId = req.user!.userId;

  try {
    const statusFilter: EmailStatus[] =
      status === 'scheduled'
        ? ['SCHEDULED', 'PROCESSING']
        : ['SENT', 'FAILED'];

    const where = {
      userId,
      status: { in: statusFilter },
    };

    const orderBy =
      status === 'scheduled'
        ? { nextRunAt: 'asc' as const }
        : { sentAt: 'desc' as const };

    const [items, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { sender: { select: { email: true } } },
      }),
      prisma.emailJob.count({ where }),
    ]);

    res.json({
      items: items.map((item) => ({
        id: item.id,
        recipientEmail: item.recipientEmail,
        subject: item.subject,
        body: item.body,
        status: item.status,
        scheduledAt: item.scheduledAt.toISOString(),
        nextRunAt: item.nextRunAt.toISOString(),
        sentAt: item.sentAt?.toISOString() ?? null,
        previewUrl: item.previewUrl,
        errorMessage: item.errorMessage,
        senderEmail: item.sender.email,
        campaignId: item.campaignId,
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/emails failed');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch emails' } });
  }
});

// GET /api/emails/search
emailsRouter.get('/search', requireAuth, validate(searchQuerySchema, 'query'), async (req, res) => {
  const { q, status, page, pageSize } = req.query as unknown as z.infer<typeof searchQuerySchema>;
  const userId = req.user!.userId;

  try {
    const result = await searchEmails({ userId, q, status, page, pageSize });
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'GET /api/emails/search failed');
    res.status(503).json({ error: { code: 'SEARCH_UNAVAILABLE', message: 'Search service unavailable' } });
  }
});

// GET /api/emails/stats
emailsRouter.get('/stats', requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  try {
    const [scheduled, processing, sent, failed] = await Promise.all([
      prisma.emailJob.count({ where: { userId, status: 'SCHEDULED' } }),
      prisma.emailJob.count({ where: { userId, status: 'PROCESSING' } }),
      prisma.emailJob.count({ where: { userId, status: 'SENT' } }),
      prisma.emailJob.count({ where: { userId, status: 'FAILED' } }),
    ]);

    res.json({
      scheduled: scheduled + processing,
      sent,
      failed,
      total: scheduled + processing + sent + failed,
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/emails/stats failed');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stats' } });
  }
});
