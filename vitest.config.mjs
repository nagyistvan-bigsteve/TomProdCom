import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve('./src/app/core'),
      '@shared': resolve('./src/app/shared'),
      '@features': resolve('./src/app/features'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.vitest.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/app/shared/utils/**'],
    },
  },
});
