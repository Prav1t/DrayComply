// The full flow in a real browser: sign up, set up drivers, upload, map, check, run, download the report.
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { SAMPLE_CSV, SAMPLE_TABLES } from '../../../packages/ingest/src/testing/sample';

const PASSWORD = 'correct horse battery staple';
const stamp = Date.now();
const NONE = { kind: 'none' };
const TEMPLATE = { id: 'e2e-records', name: 'E2E records', version: 1, tables: { ...SAMPLE_TABLES, drivers: NONE, otherLicenseeHours: NONE } };
const recordFiles = (replace: Record<string, string> = {}) =>
  Object.entries({ ...SAMPLE_CSV, ...replace }).filter(([name]) => name !== 'drivers.csv').map(([name, text]) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text) }));

async function signUp(page: Page, email: string, company: string): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Pat Payroll');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password (12 characters or more)').fill(PASSWORD);
  await page.getByLabel('Company name').fill(company);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Where things stand' })).toBeVisible();
}

async function addDriver(page: Page, id: string, cls: string, fields: Record<string, string>, selects: Record<string, string>): Promise<void> {
  await page.goto('/app/drivers');
  await page.getByLabel('Driver id (as in your exports)').fill(id);
  await page.getByRole('button', { name: 'Add driver' }).click();
  await expect(page.getByRole('heading', { name: `Driver ${id}` })).toBeVisible();
  for (const [label, value] of Object.entries(fields)) await page.getByLabel(label).fill(value);
  for (const [label, value] of Object.entries(selects)) await page.getByLabel(label).selectOption(value);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator('select[name="class"]').selectOption(cls);
  await page.getByLabel('First day').fill('2020-01-01');
  await page.getByRole('button', { name: 'Add class period' }).click();
  await expect(page.getByRole('cell', { name: '2020-01-01' })).toBeVisible();
}

async function setUpAndRun(page: Page, files: ReturnType<typeof recordFiles>): Promise<void> {
  await addDriver(page, 'D1', 'DEO', { 'Uploaded hours are complete from': '2020-01-01' }, { 'Callout days are flagged in the data': 'yes', 'Hours for other licensees are known and listed below': 'yes' });
  await page.getByLabel(/Container trucking hours for any licensee/).fill('0');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await addDriver(page, 'IO1', 'IO_TRIP', {}, { 'Fuel surcharge basis': 'published', 'Callout days are flagged in the data': 'yes' });

  await page.goto('/app/data');
  await page.getByLabel(/^Name, for example/).fill('July 2026');
  await page.getByRole('button', { name: 'Create data set' }).click();
  await expect(page.getByRole('heading', { name: /Files in "July 2026"/ })).toBeVisible();
  await page.getByLabel(/CSV or XLSX files/).setInputFiles(files);
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByRole('link', { name: 'payments.csv' })).toBeVisible();

  // The mapping is posted once through the page's own session, then opened and saved again through the builder.
  // Building a table field by field is covered by e2e/smoke.mjs.
  const saved = await page.evaluate(async template => (await fetch('/api/templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ template, purpose: 'records' }) })).status, TEMPLATE);
  expect(saved).toBe(201);
  await page.reload();
  await page.getByLabel('Start from').selectOption({ label: 'E2E records (v1)' });
  await page.getByRole('button', { name: 'Edit this template' }).click();
  await expect(page.getByText('The template is complete.')).toBeVisible();
  await page.getByRole('button', { name: 'Save this template' }).click();
  await expect(page.getByText('Template saved as version 2.')).toBeVisible();

  await page.getByRole('button', { name: 'Check the data' }).click();
}

test('sign up, drivers, upload, map, check, run and download the binder', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', e => problems.push(e.message));
  await signUp(page, `owner-${stamp}@alpha.example.test`, 'Alpha Drayage Ltd.');
  await setUpAndRun(page, recordFiles());
  await expect(page.getByText('Every row was read. No value was inferred or defaulted.')).toBeVisible();
  await page.getByRole('link', { name: 'Continue to run' }).click();
  await page.getByRole('button', { name: 'Run calculation' }).click();

  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible();
  const text = await page.locator('body').innerText();
  expect(text).toContain('Totals cover all 2 pay period(s).');
  expect(text.match(/No shortfall detected under the rules as encoded, for the data provided\./g)?.length).toBeGreaterThanOrEqual(2);
  expect(text).not.toMatch(/compliant/i);
  await expect(page.getByTestId('legal-notice')).toContainText('Pending legal review');
  await expect(page.getByTestId('unverified-notice')).toHaveCount(0);
  await expect(page.getByTestId('driver-IO1')).toContainText('Aggregate comparison');
  await expect(page.getByTestId('driver-IO1')).toContainText('Segregated comparison');

  await page.getByRole('button', { name: 'Recompute and compare' }).click();
  await expect(page.getByRole('status')).toContainText('the result is identical');

  await page.getByRole('button', { name: 'Generate the audit binder (PDF)' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('report-link').click()]);
  expect(download.suggestedFilename()).toMatch(/^draycomply-binder-\d{4}-\d{2}-\d{2}\.pdf$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const pdf = await PDFDocument.load(Buffer.concat(chunks));
  expect(pdf.getTitle()).toBe('Driver Remuneration Calculation Binder - Alpha Drayage Ltd.');
  expect(pdf.getSubject()).toBeUndefined();   // no watermark: only verified rates were used
  expect(problems).toEqual([]);
});

test('rejected rows are listed with a reason, and a corrected file clears them', async ({ page }) => {
  await signUp(page, `fix-${stamp}@charlie.example.test`, 'Charlie Haulage Ltd.');
  const bad = (SAMPLE_CSV['payments.csv'] ?? '').replace('IO1,P1,Fuel,63.94', 'IO1,P1,Fuel,sixty');
  await setUpAndRun(page, recordFiles({ 'payments.csv': bad }));
  const row = page.locator('tr.rejected');
  await expect(row).toContainText('payments.csv');
  await expect(row).toContainText('amount is not a number');
  await expect(row).toContainText('sixty');
  await expect(page.getByText('Drivers left out of a run until their rows are fixed:')).toBeVisible();
  await page.getByLabel(/CSV or XLSX files/).setInputFiles(recordFiles().filter(f => f.name === 'payments.csv'));
  await page.getByRole('button', { name: 'Upload' }).click();
  await page.getByRole('button', { name: 'Check the data' }).click();
  await expect(page.getByText('Every row was read. No value was inferred or defaulted.')).toBeVisible();
});

test('unverified rates are flagged on screen and watermarked in the report; another organization cannot open the run', async ({ page, browser }) => {
  await signUp(page, `june-${stamp}@bravo.example.test`, 'Bravo Cartage Inc.');
  await setUpAndRun(page, recordFiles({
    'periods.csv': (SAMPLE_CSV['periods.csv'] ?? '').replace('D1,P1,2026-07-05,2026-07-18,2026-07-24', 'D1,P1,2026-06-07,2026-06-20,2026-06-26'),
    'hours.csv': 'Driver,Date,Hours\nD1,2026-06-08,8.5',
    'payments.csv': (SAMPLE_CSV['payments.csv'] ?? '').replace('"$293.76",2026-07-05,2026-07-18', '"$287.73",2026-06-07,2026-06-20'),
  }));
  await page.getByRole('link', { name: 'Continue to run' }).click();
  await page.getByRole('button', { name: 'Run calculation' }).click();
  await expect(page.getByTestId('unverified-notice')).toContainText('UNVERIFIED RATES - NOT FOR RELIANCE');
  await page.getByRole('button', { name: 'Generate the audit binder (PDF)' }).click();
  await expect(page.getByText('watermarked: unverified rates')).toBeVisible();
  const runUrl = page.url();
  const reportUrl = await page.getByTestId('report-link').getAttribute('href');

  const other = await browser.newContext();
  const stranger = await other.newPage();
  await signUp(stranger, `stranger-${stamp}@delta.example.test`, 'Delta Trucking Co.');
  expect((await stranger.goto(runUrl))?.status()).toBe(404);
  expect((await stranger.request.get(reportUrl ?? '')).status()).toBe(404);
  await expect(stranger.locator('body')).not.toContainText('Bravo');
  await other.close();

  const signedOut = await browser.newContext();
  const nobody = await signedOut.newPage();
  await nobody.goto(runUrl);
  await expect(nobody).toHaveURL(/\/login$/);
  expect((await nobody.request.get(reportUrl ?? '')).status()).toBe(401);
  await signedOut.close();
});

test('every page carries the security headers, and signed-in pages are not cached', async ({ page, request }) => {
  const home = await request.get('/');
  const headers = home.headers();
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('same-origin');
  expect(headers['strict-transport-security']).toContain('max-age=31536000');
  expect(headers['x-powered-by']).toBeUndefined();
  expect((await request.get('/api/drivers')).headers()['cache-control']).toBe('no-store');
  await page.goto('/privacy');
  await expect(page.getByText('DRAFT - NEEDS LEGAL REVIEW.')).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByText('DRAFT - NEEDS LEGAL REVIEW.')).toBeVisible();
});
