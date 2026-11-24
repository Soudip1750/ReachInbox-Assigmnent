import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';

// Standard connection for API use
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

// Worker-specific connection (maxRetriesPerRequest must be null for BullMQ workers)
export const workerRedis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on('connect', () => logger.info('✅ Redis connected'));
redis.on('error', (err) => logger.error({ err }, 'Redis error'));

workerRedis.on('connect', () => logger.info('✅ Worker Redis connected'));
workerRedis.on('error', (err) => logger.error({ err }, 'Worker Redis error'));

export async function connectRedis(): Promise<void> {
  await redis.connect();
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  await workerRedis.quit();
}
