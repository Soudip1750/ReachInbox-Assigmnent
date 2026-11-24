import { describe, it, expect } from 'vitest';

// Pure CSV email parsing logic (no browser APIs needed)
// Tests the parsing rules used by the frontend lib/csv.ts

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

function extractAndDedup(text: string): {
  emails: string[];
  invalid: string[];
  duplicates: number;
} {
  const rawLines = text.split(/\r?\n/).flatMap(line => line.split(/[,;]/));
  const seen = new Set<string>();
  const emails: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;

  for (const raw of rawLines) {
    const email = raw.trim().toLowerCase().replace(/^["']|["']$/g, '');
    if (!email) continue;
    if (!isValidEmail(email)) {
      invalid.push(email);
      continue;
    }
    if (seen.has(email)) {
      duplicates++;
      continue;
    }
    seen.add(email);
    emails.push(email);
  }

  return { emails, invalid, duplicates };
}

describe('Email parsing logic - TC-F07', () => {
  it('parses simple one-per-line', () => {
    const result = extractAndDedup('alice@example.com\nbob@example.com\ncharlie@example.com');
    expect(result.emails).toHaveLength(3);
    expect(result.emails).toContain('alice@example.com');
  });

  it('removes duplicates (case-insensitive)', () => {
    const result = extractAndDedup('alice@example.com\nAlice@Example.COM\nbob@example.com');
    expect(result.emails).toHaveLength(2);
    expect(result.duplicates).toBe(1);
  });

  it('marks invalid emails', () => {
    const result = extractAndDedup('valid@example.com\nnot-an-email\n@nodomain.com');
    expect(result.emails).toContain('valid@example.com');
    expect(result.invalid.length).toBeGreaterThan(0);
  });

  it('handles comma-separated in a line', () => {
    const result = extractAndDedup('alice@example.com,bob@example.com,charlie@example.com');
    expect(result.emails).toHaveLength(3);
  });

  it('handles CRLF line endings', () => {
    const result = extractAndDedup('alice@example.com\r\nbob@example.com\r\n');
    expect(result.emails).toHaveLength(2);
  });

  it('handles semicolon separators', () => {
    const result = extractAndDedup('alice@example.com;bob@example.com');
    expect(result.emails).toHaveLength(2);
  });

  it('skips empty lines', () => {
    const result = extractAndDedup('\n\nalice@example.com\n\n\nbob@example.com\n');
    expect(result.emails).toHaveLength(2);
  });

  it('handles 1000 emails (perf)', () => {
    const lines = Array.from({ length: 1000 }, (_, i) => `user${i}@example.com`).join('\n');
    const start = Date.now();
    const result = extractAndDedup(lines);
    const elapsed = Date.now() - start;
    expect(result.emails).toHaveLength(1000);
    expect(elapsed).toBeLessThan(500); // TC-F07: < 500ms
  });
});
