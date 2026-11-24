import nodemailer, { Transporter } from 'nodemailer';
import { prisma } from '../db/prisma';
import { decrypt, encrypt } from './crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';

export class TransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientError';
  }
}

export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentError';
  }
}

function classifySmtpError(err: Error): 'transient' | 'permanent' {
  const msg = err.message.toLowerCase();
  // Permanent: bad recipient, quota exceeded on recipient side
  if (
    msg.includes('invalid recipient') ||
    msg.includes('user unknown') ||
    msg.includes('no such user') ||
    msg.includes('does not exist') ||
    msg.includes('550') ||
    msg.includes('551') ||
    msg.includes('553') ||
    msg.includes('554')
  ) {
    return 'permanent';
  }
  // Transient: timeouts, connection issues, 4xx
  return 'transient';
}

interface SendEmailOptions {
  sender: { id: string; email: string; smtpHost: string; smtpPort: number; smtpUser: string; smtpPassEnc: string };
  to: string;
  subject: string;
  body: string;
  messageId: string;
}

interface SendEmailResult {
  messageId: string;
  previewUrl: string | null;
}

// Transport pool: keyed by sender ID
const transportPool = new Map<string, Transporter>();

export async function getSenderTransport(sender: SendEmailOptions['sender']): Promise<Transporter> {
  if (transportPool.has(sender.id)) {
    return transportPool.get(sender.id)!;
  }

  const pass = decrypt(sender.smtpPassEnc);
  const transport = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: false,
    auth: {
      user: sender.smtpUser,
      pass,
    },
    pool: true,
    maxConnections: 5,
  });

  transportPool.set(sender.id, transport);
  return transport;
}

// Stub mode: for tests
let stubFailNext = false;
let stubCallCount = 0;
export function stubInjectFailure() { stubFailNext = true; }
export function getStubCallCount() { return stubCallCount; }
export function resetStubCallCount() { stubCallCount = 0; }

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const { sender, to, subject, body, messageId } = opts;

  if (env.SMTP_MODE === 'stub') {
    stubCallCount++;
    if (stubFailNext) {
      stubFailNext = false;
      throw new TransientError('Stub transient failure');
    }
    return { messageId, previewUrl: `https://ethereal.email/stub/${messageId}` };
  }

  const transport = await getSenderTransport(sender);

  try {
    const result = await transport.sendMail({
      from: `"ReachInbox" <${sender.email}>`,
      to,
      subject,
      text: body,
      headers: {
        'Message-ID': `<${messageId}@reachinbox.local>`,
      },
    });

    const previewUrl = nodemailer.getTestMessageUrl(result) || null;
    logger.info({ messageId, to, previewUrl }, 'Email sent');
    return { messageId: result.messageId, previewUrl: typeof previewUrl === 'string' ? previewUrl : null };
  } catch (err) {
    const error = err as Error;
    const kind = classifySmtpError(error);
    if (kind === 'permanent') {
      throw new PermanentError(error.message);
    }
    throw new TransientError(error.message);
  }
}

/**
 * Provision SENDER_COUNT Ethereal accounts idempotently.
 */
export async function provisionSenders(): Promise<void> {
  const count = env.SENDER_COUNT;
  const existing = await prisma.sender.count({ where: { active: true } });

  if (existing >= count) {
    logger.info({ existing, required: count }, 'Senders already provisioned');
    return;
  }

  const needed = count - existing;
  logger.info({ needed }, 'Provisioning Ethereal senders');

  for (let i = 0; i < needed; i++) {
    const account = await nodemailer.createTestAccount();
    await prisma.sender.create({
      data: {
        email: account.user,
        smtpHost: account.smtp.host,
        smtpPort: account.smtp.port,
        smtpUser: account.user,
        smtpPassEnc: encrypt(account.pass),
        active: true,
      },
    });
    logger.info({ email: account.user }, 'Provisioned Ethereal sender');
  }
}
