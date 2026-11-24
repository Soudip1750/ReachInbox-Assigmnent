import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  BACKEND_URL: z.string().url().default('http://localhost:4000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').default('postgresql://reachinbox:reachinbox@localhost:5432/reachinbox'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required').default('redis://localhost:6379'),
  ELASTICSEARCH_URL: z.string().url().default('http://localhost:9200'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('reachinbox-super-secret-jwt-key-development'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters base64').default('AV2zFL7xAasyXkSOvbxw1sMcA2Lgq+gi7ywWFKqhAoE='),

  GOOGLE_CLIENT_ID: z.string().default('dummy-google-client-id'),
  GOOGLE_CLIENT_SECRET: z.string().default('dummy-google-client-secret'),
  GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:4000/auth/google/callback'),

  SLACK_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_SECRET: z.string().default(''),
  SLACK_REDIRECT_URI: z.string().default(''),

  ADMIN_EMAILS: z.string().default(''),

  SENDER_COUNT: z.coerce.number().min(1).default(3),
  SMTP_MODE: z.enum(['ethereal', 'stub']).default('ethereal'),

  WORKER_CONCURRENCY: z.coerce.number().min(1).default(5),
  RUN_WORKER_IN_API: z.string().transform((v) => v === 'true').default('true'),

  MIN_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().min(0).default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().min(1).default(200),
  CLAIM_TIMEOUT_MS: z.coerce.number().min(0).default(120000),
  JOB_ATTEMPTS: z.coerce.number().min(1).default(3),
  JOB_BACKOFF_MS: z.coerce.number().min(0).default(5000),
  MAX_LEADS: z.coerce.number().min(1).default(10000),

  DEMO_MODE: z.string().transform((v) => v === 'true').default('false'),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
export type Env = typeof env;
