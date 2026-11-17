import { defineConfig } from 'vitest/config';

// Integration tests: each file builds its own database on the Postgres at TEST_DATABASE_URL.
export default defineConfig({
  test: { include: ['**/*.itest.ts'], exclude: ['**/node_modules/**', '**/.next/**'], testTimeout: 30_000, hookTimeout: 60_000 },
});
