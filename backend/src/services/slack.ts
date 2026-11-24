import { prisma } from '../db/prisma';
import { logger } from '../config/logger';
import { decrypt } from './crypto';

interface SlackMessage {
  text: string;
  blocks?: object[];
}

export async function sendSlackMessage(
  userId: string,
  message: SlackMessage
): Promise<boolean> {
  const connection = await prisma.slackConnection.findUnique({
    where: { userId },
  });

  if (!connection || connection.revokedAt || !connection.webhookUrlEnc) {
    return false;
  }

  let webhookUrl: string;
  try {
    webhookUrl = decrypt(connection.webhookUrlEnc);
  } catch (err) {
    logger.warn({ err, userId }, 'Failed to decrypt Slack webhook URL');
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text();
      if (body === 'invalid_token' || body === 'account_inactive') {
        await prisma.slackConnection.update({
          where: { userId },
          data: { revokedAt: new Date() },
        });
        logger.warn({ userId }, 'Slack token revoked, marked in DB');
      } else {
        logger.warn({ status: response.status, body, userId }, 'Slack webhook error');
      }
      return false;
    }

    return true;
  } catch (err) {
    logger.warn({ err, userId }, 'Slack notification failed (non-fatal)');
    return false;
  }
}

export async function notifyRateLimitHit(opts: {
  userId: string;
  senderEmail: string;
  limit: number;
  windowStart: number;
  nextWindowStart: number;
}): Promise<void> {
  const { userId, senderEmail, limit, windowStart, nextWindowStart } = opts;

  const windowDate = new Date(windowStart * 3_600_000);
  const nextWindowDate = new Date(nextWindowStart * 3_600_000);

  const message: SlackMessage = {
    text: `⚠️ Rate limit hit for sender ${senderEmail}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ ReachInbox Rate Limit Reached',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Sender:*\n${senderEmail}`,
          },
          {
            type: 'mrkdwn',
            text: `*Limit:*\n${limit} emails/hour`,
          },
          {
            type: 'mrkdwn',
            text: `*Window:*\n${windowDate.toUTCString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Remaining emails deferred to:*\n${nextWindowDate.toUTCString()}`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Emails will continue automatically in the next window. No action needed.',
          },
        ],
      },
    ],
  };

  await sendSlackMessage(userId, message);
}
