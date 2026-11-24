import { Router } from 'express';
import crypto from 'crypto';
import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import { requireAuth } from '../../middleware/auth';
import { encrypt, decrypt } from '../../services/crypto';
import { logger } from '../../config/logger';

export const slackRouter = Router();

// GET /auth/slack - Start Slack OAuth
slackRouter.get('/slack', requireAuth, (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');

  res.cookie('slack_oauth_state', state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: 'incoming-webhook',
    user_scope: '',
    redirect_uri: env.SLACK_REDIRECT_URI,
    state,
  });

  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
});

// GET /auth/slack/callback
slackRouter.get('/slack/callback', requireAuth, async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;
  const userId = req.user!.userId;

  if (error) {
    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent(error)}`);
  }

  const storedState = req.cookies?.['slack_oauth_state'] as string | undefined;
  res.clearCookie('slack_oauth_state');

  if (!state || !storedState || state !== storedState) {
    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=invalid_state`);
  }

  try {
    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: env.SLACK_REDIRECT_URI,
      }).toString(),
    });

    const data = await tokenRes.json() as {
      ok: boolean;
      error?: string;
      team?: { id: string; name: string };
      incoming_webhook?: { channel_id: string; url: string };
      access_token?: string;
    };

    if (!data.ok) {
      logger.warn({ error: data.error }, 'Slack OAuth failed');
      return res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent(data.error ?? 'oauth_failed')}`);
    }

    await prisma.slackConnection.upsert({
      where: { userId },
      create: {
        userId,
        teamId: data.team!.id,
        teamName: data.team!.name,
        channelId: data.incoming_webhook?.channel_id ?? null,
        webhookUrlEnc: data.incoming_webhook?.url ? encrypt(data.incoming_webhook.url) : null,
        accessTokenEnc: data.access_token ? encrypt(data.access_token) : null,
        revokedAt: null,
      },
      update: {
        teamId: data.team!.id,
        teamName: data.team!.name,
        channelId: data.incoming_webhook?.channel_id ?? null,
        webhookUrlEnc: data.incoming_webhook?.url ? encrypt(data.incoming_webhook.url) : null,
        accessTokenEnc: data.access_token ? encrypt(data.access_token) : null,
        revokedAt: null,
        connectedAt: new Date(),
      },
    });

    logger.info({ userId, team: data.team?.name }, 'Slack connected');
    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack_connected=true`);
  } catch (err) {
    logger.error({ err }, 'Slack callback failed');
    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=server_error`);
  }
});

// GET /api/slack/status
slackRouter.get('/status', requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  try {
    const connection = await prisma.slackConnection.findUnique({ where: { userId } });
    res.json({
      connected: !!(connection && !connection.revokedAt),
      teamName: connection?.teamName ?? null,
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/slack/status failed');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// DELETE /api/slack - Disconnect
slackRouter.delete('/', requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  try {
    const connection = await prisma.slackConnection.findUnique({ where: { userId } });
    if (connection?.accessTokenEnc) {
      try {
        const token = decrypt(connection.accessTokenEnc);
        await fetch('https://slack.com/api/auth.revoke', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch {
        // Best-effort revocation
      }
    }

    await prisma.slackConnection.update({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'DELETE /api/slack failed');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});
