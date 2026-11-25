import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { clearAdminCookie, issueAdminJwt, requireAdmin, setAdminCookie } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { reconcile } from '../../services/reconciler';
import { createBullBoard } from '../../queue/bullBoard';
import { logger } from '../../config/logger';

export const adminRouter = Router();

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// POST /admin/login
adminRouter.post('/login', validate(adminLoginSchema), (req, res) => {
  const { email, password } = req.body as z.infer<typeof adminLoginSchema>;
  const expectedEmail = env.ADMIN_EMAIL.trim().toLowerCase();
  const providedEmail = email.trim().toLowerCase();

  if (!timingSafeEquals(providedEmail, expectedEmail) || !timingSafeEquals(password, env.ADMIN_PASSWORD)) {
    res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid admin email or password' },
    });
    return;
  }

  const token = issueAdminJwt(env.ADMIN_EMAIL.trim());
  setAdminCookie(res, token);
  res.json({ ok: true, redirectUrl: '/admin/queues' });
});

// POST /admin/logout
adminRouter.post('/logout', (_req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true, loginUrl: `${env.FRONTEND_URL}/login` });
});

// Mount Bull Board at /admin/queues
const serverAdapter = createBullBoard();
adminRouter.use('/queues', requireAdmin, serverAdapter.getRouter());

// POST /admin/reconcile
adminRouter.post('/reconcile', requireAdmin, async (req, res) => {
  try {
    const result = await reconcile({ force: true });
    res.json({ success: true, result });
  } catch (err) {
    logger.error({ err }, 'Manual reconcile failed');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Reconcile failed' } });
  }
});
