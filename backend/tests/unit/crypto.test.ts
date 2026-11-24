import { describe, it, expect, vi, beforeAll } from 'vitest';

// Must set env vars BEFORE importing anything that calls env.ts
beforeAll(() => {
  process.env['NODE_ENV'] = 'test';
  process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
  process.env['JWT_SECRET'] = 'test-secret-at-least-16-chars-long';
  process.env['ENCRYPTION_KEY'] = Buffer.from('a'.repeat(32)).toString('base64');
  process.env['GOOGLE_CLIENT_ID'] = 'test-google-client-id';
  process.env['GOOGLE_CLIENT_SECRET'] = 'test-google-client-secret';
  process.env['REDIS_URL'] = 'redis://localhost:6379';
});

describe('crypto - TC-U02', async () => {
  it('round trip: encrypt then decrypt returns original', async () => {
    const { encrypt, decrypt } = await import('../../src/services/crypto');
    const plaintext = 'my-smtp-password-123!@#';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('tampered ciphertext throws', async () => {
    const { encrypt, decrypt } = await import('../../src/services/crypto');
    const encrypted = encrypt('hello');
    const tampered = Buffer.from(encrypted, 'base64');
    tampered[20] ^= 0xff; // flip bits
    expect(() => decrypt(tampered.toString('base64'))).toThrow();
  });

  it('two encryptions of same value produce different ciphertexts (random IV)', async () => {
    const { encrypt } = await import('../../src/services/crypto');
    const enc1 = encrypt('same-value');
    const enc2 = encrypt('same-value');
    expect(enc1).not.toBe(enc2);
  });

  it('short ciphertext throws', async () => {
    const { decrypt } = await import('../../src/services/crypto');
    expect(() => decrypt(Buffer.from('short').toString('base64'))).toThrow('too short');
  });
});
