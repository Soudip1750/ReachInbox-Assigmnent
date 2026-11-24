import { prisma } from '../db/prisma';
import { logger } from '../config/logger';
import { reindexAll } from './search';

async function main() {
  logger.info('Starting full reindex...');

  await reindexAll(async (page, size) => {
    const rows = await prisma.emailJob.findMany({
      skip: (page - 1) * size,
      take: size,
      include: { sender: true },
    });

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      campaignId: r.campaignId,
      recipient: r.recipientEmail,
      subject: r.subject,
      body: r.body,
      status: r.status,
      senderEmail: r.sender.email,
      scheduledAt: r.scheduledAt.toISOString(),
      sentAt: r.sentAt?.toISOString() ?? null,
      error: r.errorMessage ?? null,
    }));
  });

  logger.info('Reindex complete');
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'Reindex failed');
  process.exit(1);
});
