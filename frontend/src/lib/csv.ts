import Papa from 'papaparse';

export interface ParseResult {
  emails: string[];
  invalid: string[];
  duplicates: number;
  total: number;
}

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

function extractEmails(values: string[]): string[] {
  const emails: string[] = [];
  for (const val of values) {
    // Try splitting by common delimiters within a value
    const parts = val.split(/[,;\s]+/);
    for (const part of parts) {
      const trimmed = part.trim().toLowerCase().replace(/^["']|["']$/g, '');
      if (trimmed) emails.push(trimmed);
    }
  }
  return emails;
}

export async function parseEmailFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (result) => {
        // Flatten all cells
        const allValues: string[] = [];
        for (const row of result.data) {
          for (const cell of row) {
            allValues.push(String(cell));
          }
        }

        const rawEmails = extractEmails(allValues);
        const seen = new Set<string>();
        const valid: string[] = [];
        const invalid: string[] = [];
        let duplicates = 0;

        for (const email of rawEmails) {
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
          valid.push(email);
        }

        resolve({
          emails: valid,
          invalid,
          duplicates,
          total: rawEmails.length,
        });
      },
      error: () => {
        // Fallback: treat as line-separated
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = (e.target?.result as string) ?? '';
          const lines = text.split(/\r?\n/).filter(Boolean);
          const rawEmails = extractEmails(lines);
          const seen = new Set<string>();
          const valid: string[] = [];
          const invalid: string[] = [];
          let duplicates = 0;

          for (const email of rawEmails) {
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
            valid.push(email);
          }

          resolve({ emails: valid, invalid, duplicates, total: rawEmails.length });
        };
        reader.readAsText(file);
      },
    });
  });
}
