import { Worker, Job, DelayedError } from 'bullmq';
import { workerRedis } from '../redis/connection';
import { prisma } from '../db/prisma';
import { sendEmail, getSenderTransport, TransientError, PermanentError } from '../services/mailer';
import { loadCampaignAttachments } from '../services/attachments';
import { reserveSlot, incrSent } from '../redis/rateLimiter';
import { indexEmail } from '../services/search';
import { notifyRateLimitHit } from '../services/slack';
import { env } from '../config/env';
import { logger } from '../config/logger';
import type { EmailJobData } from '../queue/emailQueue';

const SLOT_TOLERANCE_MS = 50;

export function createEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    'email-jobs',
    async (job: Job<EmailJobData>) => {
      const { emailJobId, reservedSlot } = job.data;
      const nowMs = Date.now();

      // 1. Load the row
      const row = await prisma.emailJob.findUnique({
        where: { id: emailJobId },
        include: { sender: true, campaign: true },
      });

      if (!row) {
        logger.warn({ emailJobId }, 'EmailJob not found, skipping');
        return;
      }

      // Idempotent guard: already SENT or FAILED
      if (row.status === 'SENT' || row.status === 'FAILED') {
        logger.info({ emailJobId, status: row.status }, 'Job already terminal, skipping');
        return;
      }

      // 2. Rate limiting / slot reservation
      let slot = reservedSlot;

      if (!slot || slot > nowMs + SLOT_TOLERANCE_MS) {
        // Need to reserve a slot
        const effectiveLimit = Math.min(
          row.campaign.hourlyLimit,
          env.MAX_EMAILS_PER_HOUR_PER_SENDER
        );
        const effectiveGap = Math.max(row.campaign.delayMs, env.MIN_DELAY_BETWEEN_EMAILS_MS);

        const result = await reserveSlot(
          row.senderId,
          nowMs,
          effectiveGap,
          effectiveLimit
        );

        slot = result.slot;

        if (slot > nowMs + SLOT_TOLERANCE_MS) {
          // Defer the job
          await prisma.emailJob.update({
            where: { id: emailJobId },
            data: { nextRunAt: new Date(slot) },
          });

          await job.updateData({ ...job.data, reservedSlot: slot });
          await job.moveToDelayed(slot, job.token);
          throw new DelayedError();
        }
      }

      // 3. Atomic claim
      const claimed = await prisma.emailJob.updateMany({
        where: { id: emailJobId, status: 'SCHEDULED' },
        data: {
          status: 'PROCESSING',
          claimedAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      if (claimed.count === 0) {
        logger.info({ emailJobId }, 'Job already claimed by another worker, skipping');
        return;
      }

      // 4. Send email
      const messageId = emailJobId; // Deterministic
      try {
        await job.updateProgress(25);

        const attachments = await loadCampaignAttachments(row.campaignId);
        const { previewUrl } = await sendEmail({
          sender: row.sender,
          to: row.recipientEmail,
          subject: row.subject,
          body: row.body,
          messageId,
          attachments,
        });

        await job.updateProgress(75);

        // 5. Mark SENT
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            previewUrl,
            smtpMessageId: `<${messageId}@reachinbox.local>`,
          },
        });

        // 6. Increment sent counter and check if Slack notification needed
        const window = Math.floor(Date.now() / 3_600_000);
        const sentCount = await incrSent(row.senderId, window);
        const effectiveLimit = Math.min(row.campaign.hourlyLimit, env.MAX_EMAILS_PER_HOUR_PER_SENDER);

        if (sentCount === effectiveLimit) {
          notifyRateLimitHit({
            userId: row.userId,
            senderEmail: row.sender.email,
            limit: effectiveLimit,
            windowStart: window,
            nextWindowStart: window + 1,
          }).catch((err) => logger.warn({ err }, 'Slack notification failed'));
        }

        // 7. Index in ES (best-effort)
        const indexed = await indexEmail({
          id: row.id,
          userId: row.userId,
          campaignId: row.campaignId,
          recipient: row.recipientEmail,
          subject: row.subject,
          body: row.body,
          status: 'SENT',
          senderEmail: row.sender.email,
          scheduledAt: row.scheduledAt.toISOString(),
          nextRunAt: row.nextRunAt.toISOString(),
          sentAt: new Date().toISOString(),
          previewUrl: previewUrl ?? null,
          error: null,
        });

        if (!indexed) {
          await prisma.emailJob.update({
            where: { id: emailJobId },
            data: { esIndexed: false },
          });
        } else {
          await prisma.emailJob.update({
            where: { id: emailJobId },
            data: { esIndexed: true },
          });
        }

        await job.updateProgress(100);
        logger.info({ emailJobId, to: row.recipientEmail }, 'Email job completed');
      } catch (err) {
        const error = err as Error;

        if (err instanceof PermanentError || job.attemptsMade >= env.JOB_ATTEMPTS) {
          // Mark FAILED
          await prisma.emailJob.update({
            where: { id: emailJobId },
            data: {
              status: 'FAILED',
              errorMessage: error.message,
            },
          });

          await indexEmail({
            id: row.id,
            userId: row.userId,
            campaignId: row.campaignId,
            recipient: row.recipientEmail,
            subject: row.subject,
            body: row.body,
            status: 'FAILED',
            senderEmail: row.sender.email,
            scheduledAt: row.scheduledAt.toISOString(),
            sentAt: null,
            error: error.message,
          });

          logger.error({ emailJobId, error: error.message }, 'Email job permanently failed');
          return; // Don't throw; we've handled it
        }

        // Transient: reset to SCHEDULED and rethrow for BullMQ retry
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: { status: 'SCHEDULED', claimedAt: null },
        });

        logger.warn({ emailJobId, error: error.message }, 'Transient error, will retry');
        throw error;
      }
    },
    {
      connection: workerRedis,
      concurrency: env.WORKER_CONCURRENCY,
      lockDuration: 30000,
      stalledInterval: 15000,
      maxStalledCount: 2,
    }
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Worker job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Worker job failed');
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Worker job stalled');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker error');
  });

  return worker;
}
