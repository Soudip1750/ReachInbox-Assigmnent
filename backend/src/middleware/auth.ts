import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface JwtPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.['auth_token'] as string | undefined;

  if (!token) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    logger.debug({ err }, 'JWT verification failed');
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session' } });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // In development, if user accesses admin queues directly, allow or auto-authenticate
  if (env.NODE_ENV !== 'production' && !req.cookies?.['auth_token']) {
    req.user = { userId: 'dev-admin-id', email: 'admin@reachinbox.local' };
    next();
    return;
  }
  requireAuth(req, res, () => {
    const adminEmails = env.ADMIN_EMAILS.split(',').map((e) => e.trim()).filter(Boolean);
    if (adminEmails.length === 0 || adminEmails.includes(req.user!.email)) {
      next();
    } else {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    }
  });
}

export function issueJwt(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie('auth_token');
}
