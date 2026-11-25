import fs from 'fs';
import path from 'path';

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB

export interface CampaignAttachmentInput {
  filename: string;
  contentType: string;
  size: number;
  contentBase64: string;
}

export interface StoredAttachment {
  filename: string;
  contentType: string;
  path: string;
}

const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads', 'campaigns');

export async function saveCampaignAttachments(
  campaignId: string,
  attachments: CampaignAttachmentInput[]
): Promise<void> {
  if (attachments.length === 0) return;

  const campaignDir = path.join(UPLOADS_ROOT, path.basename(campaignId));
  await fs.promises.mkdir(campaignDir, { recursive: true });

  const manifest: StoredAttachment[] = [];

  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i];
    const safeName = path.basename(att.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const diskName = `${i}-${safeName}`;
    const filePath = path.join(campaignDir, diskName);

    const buffer = Buffer.from(att.contentBase64, 'base64');
    if (buffer.length > MAX_ATTACHMENT_BYTES) {
      throw new Error(`Attachment "${att.filename}" exceeds the 5 MB limit`);
    }

    await fs.promises.writeFile(filePath, buffer);
    manifest.push({
      filename: path.basename(att.filename),
      contentType: att.contentType || 'application/octet-stream',
      path: filePath,
    });
  }

  await fs.promises.writeFile(
    path.join(campaignDir, 'manifest.json'),
    JSON.stringify(manifest),
    'utf8'
  );
}

export async function loadCampaignAttachments(campaignId: string): Promise<StoredAttachment[]> {
  const manifestPath = path.join(UPLOADS_ROOT, path.basename(campaignId), 'manifest.json');
  try {
    const raw = await fs.promises.readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw) as StoredAttachment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
