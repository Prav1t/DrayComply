// Browser smoke test. Needs a built app serving on BASE_URL and a Chrome at CHROME_PATH. Run: npm run e2e
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:3111/try';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const dir = mkdtempSync(join(tmpdir(), 'draycomply-e2e-'));
const file = (name, text) => { const p = join(dir, name); writeFileSync(p, text); return p; };

// The built-in sample, with company driver D1 underpaid and one trip paid $19.00 under the rate.
const CSV = {
  'drivers.csv': 'Driver,Type,From,To,Employer IO,Opening Hours,Hours Complete From,Fuel,Callouts,Other Hours\nD1,Company,2020-01-01,,,0,2020-01-01,,yes,yes\nIO1,Owner Operator Trip,2020-01-01,,,,,published,yes,\n',
  'periods.csv': 'Driver,Period,Start,End,Paid On,Payer,Wait Time\nD1,P1,2026-07-05,2026-07-18,2026-07-24,licensee,0.00\nIO1,P1,2026-07-05,2026-07-18,2026-07-24,licensee,50.00\n',
  'hours.csv': 'Driver,Date,Hours\nD1,2026-07-06,8.5\n',
  'trips.csv': 'Driver,Trip,Date,Kind,Zone,Terminal,From Zone,To Zone,Containers\nIO1,T1,2026-07-06,Off-Dock,,,Q,S,1\n',
  'payments.csv': 'Driver,Period,Type,Amount,Work From,Work To,Trip\nD1,P1,Regular,"$250.00",2026-07-05,2026-07-18,\nIO1,P1,Trip,120.00,2026-07-05,2026-07-18,T1\nIO1,P1,PMR,25.00,2026-07-05,2026-07-18,\nIO1,P1,Fuel,63.94,2026-07-05,2026-07-18,\nIO1,P1,Wait,50.00,2026-07-05,2026-07-18,\n',
};
const paths = Object.entries(CSV).map(([name, text]) => file(name, text));

async function open() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const problems = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', e => problems.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });   // buttons do nothing until the page script has loaded
  return { page, problems };
}
const body = page => page.locator('body').innerText();
const steps = [];
const step = async (name, fn) => { await fn(); steps.push(name); };

await step('sample runs clean and the binder downloads', async () => {
  const { page, problems } = await open();
  assert.equal(await page.getByRole('button', { name: 'Run calculation' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Load the built-in sample' }).click();
  await page.getByRole('button', { name: 'Run calculation' }).click();
  await page.getByRole('heading', { name: 'Summary' }).waitFor();
  const text = await body(page);
  assert.match(text, /Totals cover all 2 pay period\(s\)\./);
  assert.equal((text.match(/No shortfall detected/g) ?? []).length, 2);
  assert.doesNotMatch(text, /compliant/i);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download the binder (PDF)' }).click()]);
  assert.match(download.suggestedFilename(), /^draycomply-binder-\d{4}-\d{2}-\d{2}\.pdf$/);
  assert.deepEqual(problems, []);
  await page.close();
});

await step('uploaded files with the template saved from the builder show both shortfalls', async () => {
  const { page, problems } = await open();
  // Save the sample template through the builder, as a user would, then use that file in a fresh page.
  await page.getByRole('button', { name: 'Load the built-in sample' }).click();
  await page.getByRole('button', { name: 'Edit this template' }).click();
  const [saved] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save template (JSON)' }).click()]);
  const templatePath = join(dir, 'template.json');
  await saved.saveAs(templatePath);
  await page.close();

  const second = await open();
  const [filesInput, templateInput] = await second.page.locator('input[type=file]').all();
  await filesInput.setInputFiles(paths);
  await templateInput.setInputFiles(templatePath);
  await second.page.getByLabel('Licensee name').fill('Smoke Test Ltd. (fictional)');
  await second.page.getByLabel('Licence or reference number').fill('SMOKE-1');
  await second.page.getByRole('button', { name: 'Run calculation' }).click();
  await second.page.getByRole('heading', { name: 'Summary' }).waitFor();
  const text = await body(second.page);
  // 8.5 h x $34.56 = $293.76 owed against $250.00; trip Q to S $139.00 against $120.00.
  assert.match(text, /D1\s+P1\s+Shortfall on the aggregate comparison\s+No records finding detected\s+-\$43\.76 \(short\)/);
  assert.match(text, /IO1\s+P1\s+Shortfall on the aggregate comparison\s+No records finding detected\s+-\$19\.00 \(short\)/);
  assert.match(text, /\$62\.76\s+Total short, aggregate comparison/);
  assert.deepEqual([...problems, ...second.problems], []);
  await second.page.close();
});

await step('a broken template file and a rejected row are both reported, with no $0.00 total', async () => {
  const { page, problems } = await open();
  const [filesInput, templateInput] = await page.locator('input[type=file]').all();
  await templateInput.setInputFiles(file('broken.json', '{not json'));
  await page.getByText('broken.json is not valid JSON.').waitFor();
  await page.getByRole('button', { name: 'Load the built-in sample' }).click();
  await filesInput.setInputFiles([file('payments.csv', CSV['payments.csv'].replace('"$250.00"', 'abc').replace('Fuel,63.94', 'Fuel,sixty'))]);
  await page.getByRole('button', { name: 'Run calculation' }).click();
  await page.getByRole('heading', { name: 'Rejected rows' }).waitFor();
  const text = await body(page);
  assert.match(text, /Not computed\s+Total short, aggregate comparison/);
  assert.match(text, /payments\.csv\s+2\s+amount\s+abc\s+amount is not a number/);
  assert.match(text, /No driver could be evaluated/);
  // The builder preview shows the same rejection before any run.
  await page.getByRole('button', { name: 'Edit this template' }).click();
  await page.getByRole('button', { name: /5\. Payments/ }).click();
  await page.getByText('2 of 5 row(s) would be rejected.').waitFor();
  assert.deepEqual(problems, []);
  await page.close();
});

await step('building a table from scratch preselects no unit and previews only once every choice is made', async () => {
  const { page, problems } = await open();
  await page.locator('input[type=file]').first().setInputFiles(paths);
  await page.getByRole('button', { name: 'Build a template from these files' }).click();
  await page.getByRole('button', { name: /3\. Hours worked/ }).click();
  const editor = page.locator('.table-editor');
  const pick = (label, value) => editor.locator('label', { hasText: label }).locator('select').selectOption(value);
  await pick(/^This table/, 'mapped');
  await pick(/^File/, 'hours.csv');
  const row = name => editor.locator('tbody tr', { has: page.locator('b', { hasText: new RegExp(`^${name}$`) }) });
  const column = async (name, header) => { await row(name).locator('select').first().selectOption('column'); await row(name).locator('select').nth(1).selectOption(header); };
  await column('driverId', 'Driver');
  await column('workDate', 'Date');
  await column('duration', 'Hours');
  await row('entryId').locator('select').first().selectOption('not_provided');
  await row('seq').locator('select').first().selectOption('not_provided');
  assert.equal(await row('duration').locator('select').nth(2).inputValue(), '');
  assert.match(await editor.innerText(), /hours\.workDate: needs a valid source, format and blank[\s\S]*hours\.duration: needs a valid source, format and blank/);
  assert.equal(await editor.getByText('Preview:').count(), 0);
  await row('workDate').locator('select').nth(2).selectOption('YYYY-MM-DD');
  await row('duration').locator('select').nth(2).selectOption('hours');
  await editor.getByText('Preview: how the first rows will be read. All 1 row(s) read.').waitFor();
  assert.match(await editor.innerText(), /D1\s+\S+\s+2026-07-06\s+8 h 30 min/);
  assert.deepEqual(problems, []);
  await page.close();
});

await step('an Excel file is read in the browser and its sheet and columns are offered', async () => {
  const { page, problems } = await open();
  await page.locator('input[type=file]').first().setInputFiles(new URL('../../../packages/ingest/samples/payments.xlsx', import.meta.url).pathname);
  await page.getByText('payments.xlsx').waitFor();
  await page.getByRole('button', { name: 'Build a template from these files' }).click();
  await page.getByRole('button', { name: /5\. Payments/ }).click();
  const editor = page.locator('.table-editor');
  await editor.locator('label', { hasText: /^This table/ }).locator('select').selectOption('mapped');
  await editor.locator('label', { hasText: /^File/ }).locator('select').selectOption('payments.xlsx');
  await editor.getByText('Choose the sheet to see its columns.').waitFor();
  await editor.locator('label', { hasText: /^Sheet/ }).locator('select').selectOption('Payments');
  await editor.getByText(/\d+ data row\(s\), \d+ column\(s\)\./).waitFor();
  assert.deepEqual(problems, []);
  await page.close();
});

await step('the page does not scroll sideways on a phone-width screen', async () => {
  const { page } = await open();
  await page.setViewportSize({ width: 390, height: 800 });
  await page.getByRole('button', { name: 'Load the built-in sample' }).click();
  await page.getByRole('button', { name: 'Run calculation' }).click();
  await page.getByRole('heading', { name: 'Summary' }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await page.close();
});

await browser.close();
console.log(`${steps.length} browser checks passed:\n- ${steps.join('\n- ')}`);
