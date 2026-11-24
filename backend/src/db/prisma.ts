import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: [
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(prisma as any).$on('warn', (e: unknown) => logger.warn({ e }, 'Prisma warning'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(prisma as any).$on('error', (e: unknown) => logger.error({ e }, 'Prisma error'));

if (process.env['NODE_ENV'] !== 'production') {
  global.__prisma = prisma;
}

export async function connectDB(): Promise<void> {
  await prisma.$connect();
  logger.info('✅ PostgreSQL connected');
}

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
  logger.info('PostgreSQL disconnected');
}
