// Builds one organization with a roster, a data set, a template, a completed run and a report, through the routes.
import { POST as signup } from '../app/api/auth/signup/route';
import { POST as importDrivers } from '../app/api/drivers/import/route';
import { POST as createDataset } from '../app/api/datasets/route';
import { POST as addFiles } from '../app/api/datasets/[id]/files/route';
import { POST as saveTemplate } from '../app/api/templates/route';
import { POST as createRun } from '../app/api/runs/route';
import { POST as generateReport } from '../app/api/runs/[id]/reports/route';
import { GET as listDrivers } from '../app/api/drivers/route';
import { DRIVERS_CSV, RECORD_FILES, call, cookieOf, driversTemplate, filesForm, idOf, recordsTemplate } from './harness';

export interface Tenant {
  readonly cookie: string;
  readonly email: string;
  readonly datasetId: string;
  readonly templateId: string;
  readonly runId: string;
  readonly reportId: string;
  readonly driverId: string;
  readonly uploadId: string;
}

export const PASSWORD = 'correct horse battery staple';

export async function account(email: string, organizationName: string, address = '203.0.113.7'): Promise<string> {
  const r = await call(signup, 'POST', '/api/auth/signup', { body: { email, name: 'Test Person', password: PASSWORD, organizationName }, address });
  if (r.status !== 201) throw new Error(`signup failed: ${JSON.stringify(r.body)}`);
  return cookieOf(r);
}

export async function tenant(email: string, organizationName: string, files: Record<string, string> = RECORD_FILES): Promise<Tenant> {
  const cookie = await account(email, organizationName);
  const imported = await call(importDrivers, 'POST', '/api/drivers/import', { cookie, form: filesForm({ 'drivers.csv': DRIVERS_CSV }, { template: JSON.stringify(driversTemplate()) }) });
  if (imported.status !== 200) throw new Error(`driver import failed: ${JSON.stringify(imported.body)}`);
  const datasetId = idOf(await call(createDataset, 'POST', '/api/datasets', { cookie, body: { name: 'July 2026' } }));
  const stored = await call(addFiles, 'POST', `/api/datasets/${datasetId}/files`, { cookie, params: { id: datasetId }, form: filesForm(files) });
  if (stored.status !== 201) throw new Error(`upload failed: ${JSON.stringify(stored.body)}`);
  const templateId = idOf(await call(saveTemplate, 'POST', '/api/templates', { cookie, body: { template: recordsTemplate(), purpose: 'records' } }));
  const run = await call(createRun, 'POST', '/api/runs', { cookie, body: { datasetId, templateId, asOf: '2026-11-16' } });
  if (run.status !== 201) throw new Error(`run failed: ${JSON.stringify(run.body)}`);
  const runId = idOf(run);
  // A run that stopped has no report; reportId is then empty.
  const report = await call(generateReport, 'POST', `/api/runs/${runId}/reports`, { cookie, params: { id: runId } });
  const reportId = report.status === 201 ? idOf(report) : '';
  const drivers = (await call(listDrivers, 'GET', '/api/drivers', { cookie })).body['drivers'];
  const first: unknown = Array.isArray(drivers) ? drivers[0] : null;
  const driverId = first !== null && typeof first === 'object' && 'id' in first && typeof first.id === 'string' ? first.id : '';
  return { cookie, email, datasetId, templateId, runId, reportId, driverId, uploadId: '' };
}
