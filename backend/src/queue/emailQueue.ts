import { Queue } from 'bullmq';
import { workerRedis } from '../redis/connection';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface EmailJobData {
  emailJobId: string;
  reservedSlot?: number;
}

export const emailQueue = new Queue<EmailJobData>('email-jobs', {
  connection: workerRedis,
  defaultJobOptions: {
    attempts: env.JOB_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: env.JOB_BACKOFF_MS,
    },
    removeOnComplete: {
      age: 7 * 24 * 60 * 60, // 7 days
      count: 10000,
    },
    removeOnFail: false,
  },
});

emailQueue.on('error', (err) => {
  logger.error({ err }, 'Email queue error');
});

export async function enqueueEmailJob(
  emailJobId: string,
  delayMs: number
): Promise<void> {
  await emailQueue.add(
    'send-email',
    { emailJobId },
    {
      jobId: emailJobId, // Deduplication: same ID → no-op
      delay: Math.max(0, delayMs),
    }
  );
}

export async function enqueueEmailJobsBulk(
  jobs: Array<{ emailJobId: string; delayMs: number }>
): Promise<void> {
  const CHUNK_SIZE = 500;
  for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
    const chunk = jobs.slice(i, i + CHUNK_SIZE);
    await emailQueue.addBulk(
      chunk.map(({ emailJobId, delayMs }) => ({
        name: 'send-email',
        data: { emailJobId },
        opts: {
          jobId: emailJobId,
          delay: Math.max(0, delayMs),
        },
      }))
    );
  }
  logger.info({ count: jobs.length }, 'Enqueued email jobs');
}

logger.debug('Email queue initialized');
