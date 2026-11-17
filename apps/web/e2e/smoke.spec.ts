// Runs the earlier browser checks of the in-browser workbench (now at /try) against the same server.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

test('the six workbench checks still pass', () => {
  const script = fileURLToPath(new URL('./smoke.mjs', import.meta.url));
  const run = spawnSync(process.execPath, [script], { env: { ...process.env, BASE_URL: 'http://localhost:3111/try' }, encoding: 'utf8', timeout: 80_000 });
  expect(run.stderr + run.stdout).toContain('6');
  expect(run.status).toBe(0);
});
