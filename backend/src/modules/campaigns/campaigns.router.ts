import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { enqueueEmailJobsBulk } from '../../queue/emailQueue';
import { indexEmail } from '../../services/search';

export const campaignsRouter = Router();

const campaignSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  emails: z.array(z.string().email()).min(1).max(env.MAX_LEADS),
  startTime: z.string().datetime({ offset: true }),
  delayMs: z.number().int().min(0),
  hourlyLimit: z.number().int().min(1).max(env.MAX_EMAILS_PER_HOUR_PER_SENDER),
});

// POST /api/campaigns
campaignsRouter.post('/', requireAuth, validate(campaignSchema), async (req, res) => {
  const { subject, body, emails, startTime, delayMs, hourlyLimit } = req.body as z.infer<typeof campaignSchema>;
  const userId = req.user!.userId;

  try {
    // De-duplicate emails (case-insensitive)
    const uniqueEmails = [...new Set(emails.map((e) => e.trim().toLowerCase()))];

    // Parse start time, treat past as now
    let startDate = new Date(startTime);
    if (startDate < new Date()) {
      startDate = new Date();
    }

    // Get active senders
    const senders = await prisma.sender.findMany({ where: { active: true } });
    if (senders.length === 0) {
      res.status(503).json({ error: { code: 'NO_SENDERS', message: 'No active email senders configured' } });
      return;
    }

    const S = senders.length;
    const effectiveDelay = Math.max(delayMs, env.MIN_DELAY_BETWEEN_EMAILS_MS);

    // Create campaign + email_jobs in a transaction
    const { campaign, jobIds } = await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          userId,
          subject,
          body,
          startTime: startDate,
          delayMs: effectiveDelay,
          hourlyLimit,
          totalLeads: uniqueEmails.length,
        },
      });

      // Build all jobs with schedule spreading: scheduledAt_i = startTime + floor(i / S) * delayMs
      const jobData = uniqueEmails.map((email, i) => {
        const scheduledAt = new Date(startDate.getTime() + Math.floor(i / S) * effectiveDelay);
        const sender = senders[i % S];
        return {
          campaignId: campaign.id,
          userId,
          senderId: sender.id,
          recipientEmail: email,
          subject,
          body,
          scheduledAt,
          nextRunAt: scheduledAt,
          enqueued: false,
          esIndexed: false,
        };
      });

      // Insert in chunks to avoid huge INSERTs
      const jobIds: string[] = [];
      const CHUNK = 500;
      for (let i = 0; i < jobData.length; i += CHUNK) {
        const chunk = jobData.slice(i, i + CHUNK);
        // Use createManyAndReturn if supported, else createMany + select
        for (const data of chunk) {
          const job = await tx.emailJob.create({ data, select: { id: true, scheduledAt: true } });
          jobIds.push(job.id);
        }
      }

      return { campaign, jobIds };
    });

    // Enqueue outside the transaction
    const queueJobs = uniqueEmails.map((_, i) => ({
      emailJobId: jobIds[i],
      delayMs: Math.max(0, startDate.getTime() + Math.floor(i / S) * effectiveDelay - Date.now()),
    }));

    let enqueued = false;
    try {
      await enqueueEmailJobsBulk(queueJobs);
      await prisma.emailJob.updateMany({
        where: { campaignId: campaign.id },
        data: { enqueued: true },
      });
      enqueued = true;
    } catch (err) {
      logger.error({ err, campaignId: campaign.id }, 'Enqueue failed; reconciler will fix');
    }

    // Index to ES (best-effort)
    for (let i = 0; i < jobIds.length; i++) {
      indexEmail({
        id: jobIds[i],
        userId,
        campaignId: campaign.id,
        recipient: uniqueEmails[i],
        subject,
        body,
        status: 'SCHEDULED',
        senderEmail: senders[i % S].email,
        scheduledAt: new Date(startDate.getTime() + Math.floor(i / S) * effectiveDelay).toISOString(),
        sentAt: null,
        error: null,
      }).catch(() => {/* best-effort */});
    }

    res.status(201).json({
      campaignId: campaign.id,
      total: uniqueEmails.length,
      firstRunAt: startDate.toISOString(),
      enqueued,
    });
  } catch (err) {
    logger.error({ err }, 'POST /api/campaigns failed');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create campaign' } });
  }
});
