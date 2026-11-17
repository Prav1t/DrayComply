import { defineConfig } from 'vitest/config';

// Unit tests: no database, no network.
export default defineConfig({
  test: { include: ['**/*.test.ts'], exclude: ['**/node_modules/**', '**/.next/**', '**/e2e/**'] },
});
