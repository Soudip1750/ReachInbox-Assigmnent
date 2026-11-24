import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';
import { logger } from '../config/logger';

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
  requestTimeout: 10000,
});

const INDEX_NAME = 'ri_emails';

const MAPPING = {
  mappings: {
    properties: {
      id: { type: 'keyword' },
      userId: { type: 'keyword' },
      campaignId: { type: 'keyword' },
      recipient: {
        type: 'text',
        fields: { keyword: { type: 'keyword' } },
      },
      subject: {
        type: 'text',
        fields: { keyword: { type: 'keyword' } },
      },
      body: { type: 'text' },
      status: { type: 'keyword' },
      senderEmail: { type: 'keyword' },
      scheduledAt: { type: 'date' },
      sentAt: { type: 'date' },
      error: { type: 'text' },
    },
  },
};

export async function ensureIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: INDEX_NAME });
    if (!exists) {
      await esClient.indices.create({ index: INDEX_NAME, ...MAPPING });
      logger.info({ index: INDEX_NAME }, 'Elasticsearch index created');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to ensure ES index');
  }
}

export interface EmailDoc {
  id: string;
  userId: string;
  campaignId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  senderEmail: string;
  scheduledAt: string | null;
  sentAt: string | null;
  error: string | null;
}

export async function indexEmail(doc: EmailDoc): Promise<boolean> {
  try {
    await esClient.index({
      index: INDEX_NAME,
      id: doc.id,
      document: doc,
    });
    return true;
  } catch (err) {
    logger.warn({ err, emailId: doc.id }, 'Failed to index email in ES');
    return false;
  }
}

export async function searchEmails(opts: {
  userId: string;
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: EmailDoc[]; total: number }> {
  const { userId, q, status, page = 1, pageSize = 20 } = opts;
  const from = (page - 1) * pageSize;

  const must: object[] = [{ term: { userId } }];

  if (status) {
    must.push({ term: { status: status.toUpperCase() } });
  }

  if (q && q.trim()) {
    must.push({
      multi_match: {
        query: q.trim(),
        fields: ['recipient^2', 'subject^2', 'body'],
        fuzziness: 'AUTO',
      },
    });
  }

  try {
    const result = await esClient.search<EmailDoc>({
      index: INDEX_NAME,
      from,
      size: pageSize,
      query: { bool: { must } },
      sort: [{ scheduledAt: { order: 'desc' } }],
    });

    const items = result.hits.hits.map((h) => h._source!);
    const total = typeof result.hits.total === 'number'
      ? result.hits.total
      : result.hits.total?.value ?? 0;

    return { items, total };
  } catch (err) {
    logger.error({ err }, 'ES search failed');
    throw new Error('Search service unavailable');
  }
}

export async function reindexAll(
  getRows: (page: number, size: number) => Promise<EmailDoc[]>
): Promise<void> {
  let page = 1;
  const size = 500;

  while (true) {
    const rows = await getRows(page, size);
    if (rows.length === 0) break;

    const operations = rows.flatMap((doc) => [
      { index: { _index: INDEX_NAME, _id: doc.id } },
      doc,
    ]);

    await esClient.bulk({ operations });
    logger.info({ page, count: rows.length }, 'Reindexed batch');
    page++;
  }
}
