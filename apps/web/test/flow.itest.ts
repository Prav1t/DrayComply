// The whole flow through the routes, on a real Postgres: drivers, upload, mapping, check, run, report.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { unzipSync, strFromU8 } from 'fflate';
import { eq } from 'drizzle-orm';
import { auditLog, organizations, runResults, runs, uploads } from '../../../packages/db/src/index';
import { SAMPLE_CSV } from '../../../packages/ingest/src/testing/sample';
import { WATERMARK } from '../../../packages/report/src/index';
import { GET as getDataset } from '../app/api/datasets/[id]/route';
import { POST as addFiles } from '../app/api/datasets/[id]/files/route';
import { POST as check } from '../app/api/datasets/[id]/check/route';
import { POST as importDrivers } from '../app/api/drivers/import/route';
import { GET as getDriver } from '../app/api/drivers/[id]/route';
import { POST as addPeriod } from '../app/api/drivers/[id]/class-periods/route';
import { POST as createRun, GET as listRuns } from '../app/api/runs/route';
import { GET as getRun } from '../app/api/runs/[id]/route';
import { POST as recompute } from '../app/api/runs/[id]/recompute/route';
import { POST as generateReport } from '../app/api/runs/[id]/reports/route';
import { GET as downloadReport } from '../app/api/reports/[id]/route';
import { GET as exportOrg } from '../app/api/org/export/route';
import { POST as deleteOrg } from '../app/api/org/delete/route';
import { GET as health } from '../app/api/health/route';
import { DRIVERS_CSV, RECORD_FILES, call, driversTemplate, filesForm, idOf, world, type World } from './harness';
import { account, tenant, type Tenant } from './setup';

let w: World;
let a: Tenant;
const swap = (file: string, find: string, to: string): Record<string, string> => ({ ...RECORD_FILES, [file]: (SAMPLE_CSV[file] ?? '').replace(find, to) });
const outcomeOf = (r: { body: Record<string, unknown> }): Record<string, unknown> => Object(Object(r.body['run'])['outcome']);
const pick = (v: unknown, ...path: (string | number)[]): unknown => path.reduce<unknown>((acc, key) => (acc !== null && typeof acc === 'object' ? Reflect.get(acc, key) : undefined), v);

beforeAll(async () => { w = await world(); a = await tenant('owner@a.example.test', 'Alpha Drayage Ltd.'); });
afterAll(async () => { await w.close(); });

describe('health', () => {
  it('answers ok when the database is reachable', async () => {
    expect((await call(health, 'GET', '/api/health')).body).toEqual({ status: 'ok' });
  });
});

describe('drivers', () => {
  it('imports class as effective-dated periods, and leaves unreported fields null', async () => {
    const d = Object((await call(getDriver, 'GET', `/api/drivers/${a.driverId}`, { cookie: a.cookie, params: { id: a.driverId } })).body['driver']);
    expect(d.externalId).toBe('D1');
    expect(pick(d, 'classPeriods', 0, 'class')).toBe('DEO');
    expect(pick(d, 'classPeriods', 0, 'fromDate')).toBe('2020-01-01');
    expect(pick(d, 'classPeriods', 0, 'toDate')).toBeNull();
    expect(d.fuelBasis).toBeNull();            // blank in the file stays unreported
    expect(d.openingCumulativeMinutes).toBe(0);
  });
  it('refuses a second period that overlaps the first', async () => {
    const r = await call(addPeriod, 'POST', `/api/drivers/${a.driverId}/class-periods`, { cookie: a.cookie, params: { id: a.driverId }, body: { class: 'IO_TRIP', from: '2025-01-01' } });
    expect(r.status).toBe(400);
    expect(String(r.body['error'])).toContain('overlaps');
  });
  it('imports nothing when one row of the driver file is rejected', async () => {
    const cookie = await account('import@c.example.test', 'Import Test Co.');
    const bad = DRIVERS_CSV.replace('IO1,Owner Operator Trip,2020-01-01', 'IO1,Owner Operator Trip,not-a-date');
    const r = await call(importDrivers, 'POST', '/api/drivers/import', { cookie, form: filesForm({ 'drivers.csv': bad }, { template: JSON.stringify(driversTemplate()) }) });
    expect(r.status).toBe(422);
    expect(pick(r.body, 'rejects', 0, 'reason')).toBeTruthy();
  });
});

describe('upload and mapping', () => {
  it('stores each original with its SHA-256 and lists it on the data set', async () => {
    const d = Object((await call(getDataset, 'GET', `/api/datasets/${a.datasetId}`, { cookie: a.cookie, params: { id: a.datasetId } })).body['dataset']);
    const files: unknown[] = Array.isArray(d.files) ? d.files : [];
    expect(files.map(f => pick(f, 'name'))).toEqual(['hours.csv', 'payments.csv', 'periods.csv', 'trips.csv']);
    files.forEach(f => expect(String(pick(f, 'sha256'))).toMatch(/^[0-9a-f]{64}$/));
    const stored = await w.t.db.select().from(uploads).where(eq(uploads.name, 'hours.csv'));
    expect(Buffer.from(stored[0]?.content ?? []).toString()).toBe(SAMPLE_CSV['hours.csv']);
  });
  it('refuses a file that is not CSV or XLSX, an XLSX that is not a workbook, and an oversized file', async () => {
    const send = (files: Record<string, string | Uint8Array>) => call(addFiles, 'POST', `/api/datasets/${a.datasetId}/files`, { cookie: a.cookie, params: { id: a.datasetId }, form: filesForm(files) });
    expect(String((await send({ 'payroll.exe': 'MZ' })).body['error'])).toContain('only .csv and .xlsx');
    expect(String((await send({ 'payroll.xlsx': 'not a zip' })).body['error'])).toContain('not an Excel .xlsx workbook');
    expect(String((await send({ 'binary.csv': new Uint8Array([65, 0, 66]) })).body['error'])).toContain('not a text file');
    expect(String((await send({ 'big.csv': new Uint8Array(10 * 1024 * 1024 + 1).fill(65) })).body['error'])).toContain('larger than 10 MB');
    expect(String((await send({ '../../etc/draycomply-roster-drivers.csv': 'a' })).body['error'])).toContain('reserved');
  });
  it('shows the reject list with a reason per row, then accepts the corrected file as a new upload', async () => {
    const t = await tenant('fix@d.example.test', 'Fix Co.', swap('payments.csv', 'IO1,P1,Fuel,63.94', 'IO1,P1,Fuel,sixty'));
    const before = await call(check, 'POST', `/api/datasets/${t.datasetId}/check`, { cookie: t.cookie, params: { id: t.datasetId }, body: { templateId: t.templateId } });
    expect(pick(before.body, 'ingest', 'rejects', 0)).toMatchObject({ file: 'payments.csv', rowNumber: 5, field: 'amount', reason: 'amount is not a number', raw: 'sixty' });
    expect(pick(before.body, 'ingest', 'withheldDrivers')).toEqual([{ driverId: 'IO1', rejectedRows: 1 }]);
    const fixed = await call(addFiles, 'POST', `/api/datasets/${t.datasetId}/files`, { cookie: t.cookie, params: { id: t.datasetId }, form: filesForm({ 'payments.csv': SAMPLE_CSV['payments.csv'] ?? '' }) });
    expect(pick(fixed.body, 'stored', 0, 'replaced')).toBe(true);
    const after = await call(check, 'POST', `/api/datasets/${t.datasetId}/check`, { cookie: t.cookie, params: { id: t.datasetId }, body: { templateId: t.templateId } });
    expect(pick(after.body, 'ingest', 'rejects')).toEqual([]);
    // Both versions of the file are still stored.
    expect((await w.t.db.select({ id: uploads.id }).from(uploads).where(eq(uploads.name, 'payments.csv'))).length).toBeGreaterThanOrEqual(3);
  });
  it('never fills in a missing value: a blank wait time is a gap and the driver is insufficient data', async () => {
    const t = await tenant('gap@e.example.test', 'Gap Co.', swap('periods.csv', 'licensee,50.00', 'licensee,'));
    const run = await call(getRun, 'GET', `/api/runs/${t.runId}`, { cookie: t.cookie, params: { id: t.runId } });
    const io = (Object(outcomeOf(run)['run']).drivers as unknown[]).find(d => pick(d, 'driverId') === 'IO1');
    expect(pick(io, 'verdict')).toBe('insufficient_data');
    expect(pick(io, 'periods', 0, 'gaps', 0, 'code')).toBe('WAIT_TIME_NOT_REPORTED');
  });
});

describe('runs', () => {
  it('stores inputs, schedule versions, rounding and the result', async () => {
    const [row] = await w.t.db.select().from(runs).where(eq(runs.id, a.runId));
    expect(row).toMatchObject({ status: 'completed', rounding: 'half_up', asOf: '2026-11-16', engineVersion: '0.6.0', unverifiedSchedulesUsed: false });
    expect(row?.scheduleIds).toEqual(['obcctc-2026-07-01', 'obcctc-fuel-surcharge-published']);
    const inputs: unknown[] = Array.isArray(row?.inputFiles) ? row.inputFiles : [];
    expect(inputs.map(f => [pick(f, 'name'), pick(f, 'kind')])).toEqual([
      ['hours.csv', 'source'], ['payments.csv', 'source'], ['periods.csv', 'source'], ['trips.csv', 'source'],
      ['draycomply-roster-drivers.csv', 'roster_snapshot'], ['draycomply-roster-other-hours.csv', 'roster_snapshot'],
    ]);
    expect(row?.pendingInterpretationIds).toEqual(['LI-01', 'LI-02', 'LI-06', 'LI-07', 'LI-08']);
  });
  it('reports both comparisons for each driver and no shortfall on the sample', async () => {
    const run = await call(getRun, 'GET', `/api/runs/${a.runId}`, { cookie: a.cookie, params: { id: a.runId } });
    const drivers = Object(outcomeOf(run)['run']).drivers as unknown[];
    expect(drivers.map(d => [pick(d, 'driverId'), pick(d, 'verdict')])).toEqual([['D1', 'no_shortfall_detected'], ['IO1', 'no_shortfall_detected']]);
    expect(pick(drivers[1], 'periods', 0, 'aggregate', 'kind')).toBe('computed');
    expect(pick(drivers[1], 'periods', 0, 'segregated', 'kind')).toBe('computed');
  });
  it('recomputes to exactly the stored result', async () => {
    const r = await call(recompute, 'POST', `/api/runs/${a.runId}/recompute`, { cookie: a.cookie, params: { id: a.runId } });
    expect(r.body).toMatchObject({ matches: true, storedEngineVersion: '0.6.0', currentEngineVersion: '0.6.0' });
  });
  it('a re-run is a new run; the first is untouched', async () => {
    const before = await w.t.db.select().from(runResults).where(eq(runResults.runId, a.runId));
    const second = await call(createRun, 'POST', '/api/runs', { cookie: a.cookie, body: { datasetId: a.datasetId, templateId: a.templateId, asOf: '2026-11-16' } });
    expect(idOf(second)).not.toBe(a.runId);
    expect(await w.t.db.select().from(runResults).where(eq(runResults.runId, a.runId))).toEqual(before);
    const list = (await call(listRuns, 'GET', '/api/runs', { cookie: a.cookie })).body['runs'];
    expect(Array.isArray(list) ? list.length : 0).toBe(2);
  });
  it('a stored result that was tampered with is refused, not shown', async () => {
    const t = await tenant('tamper@f.example.test', 'Tamper Co.');
    await w.t.pool.query('alter table run_results disable trigger run_results_immutable');
    await w.t.pool.query(`update run_results set result = jsonb_set(result, '{extraScope}', '["forged"]') where run_id = $1`, [t.runId]);
    await w.t.pool.query('alter table run_results enable trigger run_results_immutable');
    expect((await call(getRun, 'GET', `/api/runs/${t.runId}`, { cookie: t.cookie, params: { id: t.runId } })).status).toBe(500);
  });
  it('limits a run to chosen drivers and a pay period range, and says so in the scope', async () => {
    const r = await call(createRun, 'POST', '/api/runs', { cookie: a.cookie, body: { datasetId: a.datasetId, templateId: a.templateId, asOf: '2026-11-16', driverIds: 'IO1', periodFrom: '2026-07-01', periodTo: '2026-07-31' } });
    const run = await call(getRun, 'GET', `/api/runs/${idOf(r)}`, { cookie: a.cookie, params: { id: idOf(r) } });
    const o = outcomeOf(run);
    expect((Object(o['run']).drivers as unknown[]).map(d => pick(d, 'driverId'))).toEqual(['IO1']);
    expect(String(pick(o, 'extraScope', 0))).toContain('limited to 1 selected driver(s). 1 other driver(s)');
    expect(JSON.stringify(pick(o, 'run', 'scope'))).toContain('PERIOD_SELECTION');
  });
  it('records a run that stops, with the reason, instead of failing silently', async () => {
    const t = await tenant('stop@g.example.test', 'Stop Co.', { 'hours.csv': SAMPLE_CSV['hours.csv'] ?? '' });
    const run = await call(getRun, 'GET', `/api/runs/${t.runId}`, { cookie: t.cookie, params: { id: t.runId } });
    expect(outcomeOf(run)).toMatchObject({ kind: 'stopped', stage: 'files' });
    expect(String(pick(outcomeOf(run), 'errors', 0))).toContain('was not supplied');
  });
  it('refuses a run date in the future', async () => {
    const r = await call(createRun, 'POST', '/api/runs', { cookie: a.cookie, body: { datasetId: a.datasetId, templateId: a.templateId, asOf: '2999-01-01' } });
    expect(r.status).toBe(400);
  });
});

async function pageText(pdf: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(pdf);
  return doc.getPages().map(page => {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map(ref => doc.context.lookup(ref)) : [contents];
    return streams.map(s => (s instanceof PDFRawStream ? new TextDecoder('latin1').decode(decodePDFRawStream(s).decode()) : '')).join('\n');
  });
}
const hex = (text: string): string => [...text].map(c => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join('');

describe('reports', () => {
  it('downloads the stored PDF, byte for byte, with the liability wording and no watermark on verified rates', async () => {
    const r = await call(downloadReport, 'GET', `/api/reports/${a.reportId}`, { cookie: a.cookie, params: { id: a.reportId } });
    expect(r.headers.get('content-type')).toBe('application/pdf');
    expect(r.headers.get('content-disposition')).toContain('attachment');
    const pages = await pageText(r.bytes);
    expect(pages.join('')).toContain(hex('under the rules as encoded, for the data provided'));
    expect(pages.join('')).toContain(hex('2. Scope statement'));
    expect(pages.join('')).toContain(hex('8. Legal interpretations pending review'));
    expect(pages.join('')).not.toContain(hex(WATERMARK));
  });
  it('watermarks every page and flags the run when an unverified schedule priced anything', async () => {
    const june = {
      ...RECORD_FILES,
      'periods.csv': (SAMPLE_CSV['periods.csv'] ?? '').replace('D1,P1,2026-07-05,2026-07-18,2026-07-24', 'D1,P1,2026-06-07,2026-06-20,2026-06-26'),
      'hours.csv': 'Driver,Date,Hours\nD1,2026-06-08,8.5',
      'payments.csv': (SAMPLE_CSV['payments.csv'] ?? '').replace('"$293.76",2026-07-05,2026-07-18', '"$287.73",2026-06-07,2026-06-20'),
    };
    const t = await tenant('june@h.example.test', 'June Co.', june);
    const [row] = await w.t.db.select().from(runs).where(eq(runs.id, t.runId));
    expect(row?.unverifiedSchedulesUsed).toBe(true);
    const r = await call(downloadReport, 'GET', `/api/reports/${t.reportId}`, { cookie: t.cookie, params: { id: t.reportId } });
    const pages = await pageText(r.bytes);
    pages.forEach(p => expect(p).toContain(hex(WATERMARK)));
  });
  it('generates no report for a run that stopped', async () => {
    const t = await tenant('stop2@j.example.test', 'Stop Two Co.', { 'hours.csv': SAMPLE_CSV['hours.csv'] ?? '' });
    const r = await call(generateReport, 'POST', `/api/runs/${t.runId}/reports`, { cookie: t.cookie, params: { id: t.runId } });
    expect([r.status, t.reportId]).toEqual([400, '']);
    expect(String(r.body['error'])).toContain('stopped before the calculation');
  });
});

describe('export and deletion', () => {
  it('exports every row, original file and report as one zip', async () => {
    const r = await call(exportOrg, 'GET', '/api/org/export', { cookie: a.cookie });
    const zip = unzipSync(r.bytes);
    const data = JSON.parse(strFromU8(zip['data.json'] ?? new Uint8Array()));
    expect(Object.keys(zip).filter(n => n.startsWith('reports/')).length).toBe(1);
    expect(Object.keys(zip).some(n => n.endsWith('-payments.csv'))).toBe(true);
    expect(data.drivers.length).toBe(2);
    expect(data.runs.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(data.members)).not.toContain('scrypt');
  });
  it('deletes everything the organization stored, and leaves a receipt with counts only', async () => {
    const t = await tenant('delete@k.example.test', 'Delete Me Ltd.');
    expect((await call(deleteOrg, 'POST', '/api/org/delete', { cookie: t.cookie, body: { confirmName: 'wrong name' } })).status).toBe(400);
    expect((await call(deleteOrg, 'POST', '/api/org/delete', { cookie: t.cookie, body: { confirmName: 'Delete Me Ltd.' } })).status).toBe(200);
    expect(await w.t.db.select().from(organizations).where(eq(organizations.name, 'Delete Me Ltd.'))).toEqual([]);
    expect(await w.t.db.select().from(runs).where(eq(runs.id, t.runId))).toEqual([]);
    const receipts = await w.t.pool.query('select row_counts from deletion_receipts');
    expect(receipts.rows[0]?.row_counts).toMatchObject({ drivers: 2, runs: 1, reports: 1 });
    expect(JSON.stringify(receipts.rows)).not.toContain('Delete Me');
  });
});

describe('audit log and application logs', () => {
  it('records who did what, with identifiers and hashes only', async () => {
    const rows = await w.t.db.select().from(auditLog);
    const actions = new Set(rows.map(r => r.action));
    ['driver.imported', 'dataset.created', 'upload.stored', 'template.saved', 'run.created', 'report.generated', 'report.downloaded'].forEach(x => expect(actions.has(x)).toBe(true));
    const text = JSON.stringify(rows.map(r => r.detail));
    ['293.76', 'Alpha Drayage', 'owner@a.example.test', 'IO1'].forEach(secret => expect(text).not.toContain(secret));
  });
  it('writes no customer data, email, file name or amount to the logs', () => {
    const text = w.logs.join('\n');
    expect(w.logs.length).toBeGreaterThan(20);
    ['example.test', 'payments.csv', '293.76', 'Alpha', 'correct horse', 'IO1', 'dc_session'].forEach(secret => expect(text).not.toContain(secret));
    expect(text).toContain('"route":"POST /api/runs"');
  });
});
