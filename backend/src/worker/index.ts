import { createEmailWorker } from './processor';
import { logger } from '../config/logger';
import { connectRedis, disconnectRedis } from '../redis/connection';
import { disconnectDB } from '../db/prisma';
import { ensureIndex } from '../services/search';

let worker: ReturnType<typeof createEmailWorker> | null = null;

export async function startWorker(): Promise<void> {
  worker = createEmailWorker();
  logger.info({ concurrency: worker.concurrency }, '✅ Email worker started');
}

export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    logger.info('Email worker stopped');
  }
}

// Standalone entry point (when RUN_WORKER_IN_API=false)
if (require.main === module) {
  async function main() {
    await connectRedis();
    await ensureIndex();
    await startWorker();

    logger.info('Worker process running. Press Ctrl+C to stop.');

    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Graceful shutdown initiated');
      await stopWorker();
      await disconnectRedis();
      await disconnectDB();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  main().catch((err) => {
    logger.error({ err }, 'Worker failed to start');
    process.exit(1);
  });
}
