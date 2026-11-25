import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { searchEmails, resolveStatusFilter, type EmailDoc } from '../../services/search';
import { logger } from '../../config/logger';
import type { EmailJob, EmailStatus, Prisma } from '@prisma/client';

export const emailsRouter = Router();

function formatEmailJob(item: EmailJob & { sender: { email: string } }) {
  return {
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
  };
}

function formatSearchDoc(doc: EmailDoc) {
  const fallbackDate = doc.scheduledAt ?? new Date(0).toISOString();
  return {
    id: doc.id,
    recipientEmail: doc.recipient,
    subject: doc.subject,
    body: doc.body,
    status: doc.status,
    scheduledAt: fallbackDate,
    nextRunAt: doc.nextRunAt ?? fallbackDate,
    sentAt: doc.sentAt ?? null,
    previewUrl: doc.previewUrl ?? null,
    errorMessage: doc.error ?? null,
    senderEmail: doc.senderEmail,
    campaignId: doc.campaignId,
  };
}

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
      items: items.map(formatEmailJob),
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
    res.json({
      items: result.items.map(formatSearchDoc),
      total: result.total,
      page,
      pageSize,
    });
    return;
  } catch (err) {
    logger.warn({ err }, 'ES search unavailable, falling back to database search');
  }

  // Fallback to PostgreSQL when Elasticsearch is unavailable
  try {
    const statuses = resolveStatusFilter(status) as EmailStatus[] | undefined;
    const trimmedQ = q?.trim();

    const where: Prisma.EmailJobWhereInput = {
      userId,
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(trimmedQ
        ? {
            OR: [
              { recipientEmail: { contains: trimmedQ, mode: 'insensitive' } },
              { subject: { contains: trimmedQ, mode: 'insensitive' } },
              { body: { contains: trimmedQ, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy =
      status?.trim().toLowerCase() === 'scheduled'
        ? { nextRunAt: 'asc' as const }
        : { scheduledAt: 'desc' as const };

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
      items: items.map(formatEmailJob),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/emails/search failed');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to search emails' } });
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
