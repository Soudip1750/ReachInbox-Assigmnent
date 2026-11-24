import { prisma } from '../db/prisma';
import { enqueueEmailJobsBulk } from '../queue/emailQueue';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { acquireReconcilerLock, releaseReconcilerLock } from '../redis/rateLimiter';
import { emailQueue } from '../queue/emailQueue';

const BATCH_SIZE = 1000;

export interface ReconcileResult {
  scheduled: number;
  staleProcessing: number;
  total: number;
}

/**
 * Boot reconciler: 
 * a) SCHEDULED rows with missing BullMQ jobs → re-enqueue
 * b) Stale PROCESSING rows → reset to SCHEDULED + re-enqueue
 */
export async function reconcile(options?: { force?: boolean }): Promise<ReconcileResult> {
  // Guard against concurrent reconcile runs
  const acquired = await acquireReconcilerLock(60_000);
  if (!acquired && !options?.force) {
    logger.warn('Reconciler already running (lock held)');
    return { scheduled: 0, staleProcessing: 0, total: 0 };
  }

  let totalScheduled = 0;
  let totalStale = 0;

  try {
    // --- Part A: stale PROCESSING rows ---
    const staleClaimedBefore = new Date(Date.now() - env.CLAIM_TIMEOUT_MS);
    let staleOffset = 0;

    while (true) {
      const staleRows = await prisma.emailJob.findMany({
        where: {
          status: 'PROCESSING',
          claimedAt: { lt: staleClaimedBefore },
        },
        select: { id: true, nextRunAt: true },
        take: BATCH_SIZE,
        skip: staleOffset,
      });

      if (staleRows.length === 0) break;

      await prisma.emailJob.updateMany({
        where: { id: { in: staleRows.map((r) => r.id) } },
        data: { status: 'SCHEDULED', claimedAt: null },
      });

      const toEnqueue = staleRows.map((r) => ({
        emailJobId: r.id,
        delayMs: Math.max(0, r.nextRunAt.getTime() - Date.now()),
      }));
      await enqueueEmailJobsBulk(toEnqueue);

      totalStale += staleRows.length;
      staleOffset += staleRows.length;
      logger.info({ count: staleRows.length }, 'Recovered stale PROCESSING rows');
    }

    // --- Part B: SCHEDULED rows not yet enqueued ---
    let offset = 0;

    while (true) {
      const rows = await prisma.emailJob.findMany({
        where: {
          status: 'SCHEDULED',
          enqueued: false,
        },
        select: { id: true, nextRunAt: true },
        take: BATCH_SIZE,
        skip: offset,
      });

      if (rows.length === 0) break;

      const toEnqueue = rows.map((r) => ({
        emailJobId: r.id,
        delayMs: Math.max(0, r.nextRunAt.getTime() - Date.now()),
      }));

      await enqueueEmailJobsBulk(toEnqueue);

      await prisma.emailJob.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { enqueued: true },
      });

      totalScheduled += rows.length;
      offset += rows.length;
      logger.info({ count: rows.length }, 'Re-enqueued SCHEDULED rows');
    }

    // --- Part C: SCHEDULED rows with enqueued=true but missing BullMQ job ---
    // Check a sample of "enqueued" rows to verify they're actually in the queue
    const enqueuedRows = await prisma.emailJob.findMany({
      where: { status: 'SCHEDULED', enqueued: true },
      select: { id: true, nextRunAt: true },
      take: BATCH_SIZE,
    });

    const missingJobs: Array<{ emailJobId: string; delayMs: number }> = [];
    for (const row of enqueuedRows) {
      const job = await emailQueue.getJob(row.id);
      if (!job) {
        missingJobs.push({
          emailJobId: row.id,
          delayMs: Math.max(0, row.nextRunAt.getTime() - Date.now()),
        });
      }
    }

    if (missingJobs.length > 0) {
      await enqueueEmailJobsBulk(missingJobs);
      totalScheduled += missingJobs.length;
      logger.info({ count: missingJobs.length }, 'Re-enqueued missing BullMQ jobs');
    }

    const result = { scheduled: totalScheduled, staleProcessing: totalStale, total: totalScheduled + totalStale };
    logger.info(result, 'Reconciliation complete');
    return result;
  } finally {
    await releaseReconcilerLock();
  }
}
