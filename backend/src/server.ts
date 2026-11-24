import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDB, disconnectDB } from './db/prisma';
import { connectRedis, disconnectRedis } from './redis/connection';
import { provisionSenders } from './services/mailer';
import { ensureIndex } from './services/search';
import { reconcile } from './services/reconciler';
import { startWorker, stopWorker } from './worker/index';

async function main() {
  // Connect infrastructure
  await connectDB();
  await connectRedis();

  // Provision senders and ES index (non-fatal — server starts even if these fail)
  await provisionSenders().catch((err) => logger.warn({ err }, 'Sender provisioning failed (non-fatal)'));
  await ensureIndex();

  // Boot reconciler (one-shot, not a scheduler)
  reconcile().catch((err) => logger.warn({ err }, 'Boot reconcile failed'));

  // Start worker in-process if configured
  if (env.RUN_WORKER_IN_API) {
    await startWorker();
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, `✅ Server listening`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Graceful shutdown started');
    server.close(async () => {
      await stopWorker();
      await disconnectRedis();
      await disconnectDB();
      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Force exit after 30s
    setTimeout(() => process.exit(1), 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Server failed to start');
  process.exit(1);
});
