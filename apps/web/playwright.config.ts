import { defineConfig } from '@playwright/test';

const PORT = 3111;
const BASE = `http://localhost:${PORT}`;
const ADMIN = process.env['TEST_DATABASE_URL'] ?? 'postgresql://dray:dray@localhost:5432/postgres';
const target = new URL(ADMIN);
target.pathname = '/dray_e2e';

// Needs a built app (npm run build) and a Postgres at TEST_DATABASE_URL. The database dray_e2e is rebuilt on every run.
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    launchOptions: process.env['CHROME_PATH'] === undefined ? {} : { executablePath: process.env['CHROME_PATH'], args: ['--no-sandbox'] },
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `${BASE}/login`,   // a page that needs no database: the database is rebuilt after the server starts
    reuseExistingServer: false,
    timeout: 60_000,
    env: { DATABASE_URL: target.toString(), APP_URL: BASE, SIGNUP_OPEN: 'true', NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
  },
});
