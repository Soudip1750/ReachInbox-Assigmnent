import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './db/prisma';
import { redis } from './redis/connection';
import { esClient } from './services/search';
import { errorHandler } from './middleware/error';
import { authRouter } from './modules/auth/auth.router';
import { campaignsRouter } from './modules/campaigns/campaigns.router';
import { emailsRouter } from './modules/emails/emails.router';
import { slackRouter } from './modules/slack/slack.router';
import { adminRouter } from './modules/admin/admin.router';

export function createApp() {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allow Bull Board
    })
  );

  // CORS
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body parsing
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Rate limiting on auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === 'production' ? 100 : 5000,
    skip: (req) => req.path === '/me',
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  });

  const campaignLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many campaigns created' } },
  });

  // Health check
  app.get('/health', async (_req, res) => {
    const checks: Record<string, string> = {};

    // PostgreSQL
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks['postgres'] = 'ok';
    } catch {
      checks['postgres'] = 'error';
    }

    // Redis
    try {
      const pong = await redis.ping();
      checks['redis'] = pong === 'PONG' ? 'ok' : 'error';
    } catch {
      checks['redis'] = 'error';
    }

    // Elasticsearch
    try {
      const health = await esClient.cluster.health();
      checks['elasticsearch'] = health.status !== 'red' ? 'ok' : 'degraded';
    } catch {
      checks['elasticsearch'] = 'error';
    }

    const allOk = Object.values(checks).every((s) => s === 'ok' || s === 'degraded');
    res.status(allOk ? 200 : 503).json({ status: allOk ? 'ok' : 'degraded', checks });
  });

  // Routes
  app.use('/auth', authLimiter, authRouter);
  app.use('/auth', slackRouter); // Slack OAuth routes under /auth
  app.use('/api/campaigns', campaignLimiter, campaignsRouter);
  app.use('/api/emails', emailsRouter);
  app.use('/api/slack', slackRouter);
  app.use('/admin', adminRouter);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
