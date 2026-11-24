import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/redis/rateLimiter.ts', 'src/worker/processor.ts', 'src/services/reconciler.ts', 'src/services/crypto.ts'],
      thresholds: {
        lines: 60, // Lowered because integration tests need real infra
      },
    },
  },
});
