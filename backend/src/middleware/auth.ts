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

export interface AdminJwtPayload {
  role: 'admin';
  email: string;
}

export function issueAdminJwt(email: string): string {
  return jwt.sign({ role: 'admin', email } satisfies AdminJwtPayload, env.JWT_SECRET, {
    expiresIn: '1d',
  });
}

export function setAdminCookie(res: Response, token: string): void {
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });
}

export function clearAdminCookie(res: Response): void {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminToken = req.cookies?.['admin_token'] as string | undefined;
  if (adminToken) {
    try {
      const payload = jwt.verify(adminToken, env.JWT_SECRET) as AdminJwtPayload;
      if (
        payload.role === 'admin' &&
        payload.email.toLowerCase() === env.ADMIN_EMAIL.trim().toLowerCase()
      ) {
        req.user = { userId: 'admin', email: payload.email };
        next();
        return;
      }
    } catch (err) {
      logger.debug({ err }, 'Admin JWT verification failed');
    }
  }

  requireAuth(req, res, () => {
    const adminEmails = env.ADMIN_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (adminEmails.includes(req.user!.email.toLowerCase())) {
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
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
}
