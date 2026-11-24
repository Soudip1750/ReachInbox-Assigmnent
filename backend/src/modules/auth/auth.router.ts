import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import { logger } from '../../config/logger';
import { issueJwt, setAuthCookie, clearAuthCookie, requireAuth } from '../../middleware/auth';

export const authRouter = Router();

const oauthClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

// GET /auth/google - Redirect to Google consent
authRouter.get('/google', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');

  // Store state in a short-lived cookie
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
  });

  const url = oauthClient.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });

  res.redirect(url);
});

// GET /auth/google/callback
authRouter.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    logger.warn({ error }, 'Google OAuth error');
    return res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
  }

  const storedState = req.cookies?.['oauth_state'] as string | undefined;
  res.clearCookie('oauth_state');

  if (!state || !storedState || state !== storedState) {
    logger.warn({ state, storedState }, 'OAuth state mismatch');
    return res.redirect(`${env.FRONTEND_URL}/login?error=invalid_state`);
  }

  try {
    const { tokens } = await oauthClient.getToken(code);
    oauthClient.setCredentials(tokens);

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token!,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload?.email) {
      return res.redirect(`${env.FRONTEND_URL}/login?error=invalid_token`);
    }

    // Upsert user
    const user = await prisma.user.upsert({
      where: { googleId: payload.sub },
      create: {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email.split('@')[0],
        avatarUrl: payload.picture ?? null,
      },
      update: {
        email: payload.email,
        name: payload.name ?? payload.email.split('@')[0],
        avatarUrl: payload.picture ?? null,
      },
    });

    const token = issueJwt({ userId: user.id, email: user.email });
    setAuthCookie(res, token);

    logger.info({ userId: user.id, email: user.email }, 'User logged in');
    return res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (err) {
    logger.error({ err }, 'Google OAuth callback failed');
    return res.redirect(`${env.FRONTEND_URL}/login?error=server_error`);
  }
});

// GET /auth/me
authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { slackConnection: { select: { id: true, teamName: true, revokedAt: true } } },
    });

    if (!user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } });
      return;
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      slackConnected: !!(user.slackConnection && !user.slackConnection.revokedAt),
      slackTeamName: user.slackConnection?.teamName ?? null,
    });
  } catch (err) {
    logger.error({ err }, '/auth/me failed');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// POST /auth/logout
authRouter.post('/logout', requireAuth, (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});
