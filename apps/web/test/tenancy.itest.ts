// One organization cannot read or change another's data through any route.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { TENANT_TABLES, driverClassPeriods, mappingTemplates, uploads, users } from '../../../packages/db/src/index';
import * as drivers from '../app/api/drivers/route';
import * as driver from '../app/api/drivers/[id]/route';
import * as classPeriods from '../app/api/drivers/[id]/class-periods/route';
import * as classPeriod from '../app/api/drivers/[id]/class-periods/[periodId]/route';
import * as otherHours from '../app/api/drivers/[id]/other-hours/route';
import * as otherHour from '../app/api/drivers/[id]/other-hours/[entryId]/route';
import * as driverImport from '../app/api/drivers/import/route';
import * as datasets from '../app/api/datasets/route';
import * as dataset from '../app/api/datasets/[id]/route';
import * as datasetFilesRoute from '../app/api/datasets/[id]/files/route';
import * as datasetCheck from '../app/api/datasets/[id]/check/route';
import * as upload from '../app/api/uploads/[id]/route';
import * as templates from '../app/api/templates/route';
import * as template from '../app/api/templates/[id]/route';
import * as runsRoute from '../app/api/runs/route';
import * as run from '../app/api/runs/[id]/route';
import * as runRecompute from '../app/api/runs/[id]/recompute/route';
import * as runReports from '../app/api/runs/[id]/reports/route';
import * as report from '../app/api/reports/[id]/route';
import * as org from '../app/api/org/route';
import * as orgInvitations from '../app/api/org/invitations/route';
import * as orgMember from '../app/api/org/members/[userId]/route';
import * as orgExport from '../app/api/org/export/route';
import * as orgAudit from '../app/api/org/audit/route';
import * as sessionOrg from '../app/api/session/organization/route';
import { SAMPLE_CSV } from '../../../packages/ingest/src/testing/sample';
import { call, filesForm, world, type CallOptions, type Reply, type World } from './harness';
import { tenant, type Tenant } from './setup';

let w: World;
let a: Tenant;
let b: Tenant;
let aUpload = '';
let aPeriod = '';
let aUser = '';
let aOrg = '';

beforeAll(async () => {
  w = await world();
  a = await tenant('owner@alpha.example.test', 'Alpha Drayage Ltd.');
  b = await tenant('owner@bravo.example.test', 'Bravo Cartage Inc.');
  aUpload = (await w.t.db.select({ id: uploads.id }).from(uploads).innerJoin(users, eq(users.id, uploads.uploadedBy)).where(eq(users.email, a.email)))[0]?.id ?? '';
  aPeriod = (await w.t.db.select({ id: driverClassPeriods.id }).from(driverClassPeriods).where(eq(driverClassPeriods.driverId, a.driverId)))[0]?.id ?? '';
  aUser = (await w.t.db.select({ id: users.id }).from(users).where(eq(users.email, a.email)))[0]?.id ?? '';
  aOrg = (await w.t.db.select({ o: mappingTemplates.organizationId }).from(mappingTemplates).where(eq(mappingTemplates.id, a.templateId)))[0]?.o ?? '';
});
afterAll(async () => { await w.close(); });

type Handler = Parameters<typeof call>[0];
interface Attack { readonly route: string; readonly handler: Handler; readonly method: string; readonly options: () => CallOptions }

// Every route that takes an identifier, called by organization B with organization A's identifiers.
const attacks = (): Attack[] => [
  { route: 'drivers/[id]', handler: driver.GET, method: 'GET', options: () => ({ params: { id: a.driverId } }) },
  { route: 'drivers/[id]', handler: driver.PUT, method: 'PUT', options: () => ({ params: { id: a.driverId }, body: { externalId: 'STOLEN' } }) },
  { route: 'drivers/[id]/class-periods', handler: classPeriods.POST, method: 'POST', options: () => ({ params: { id: a.driverId }, body: { class: 'DEO', from: '2010-01-01', to: '2010-12-31' } }) },
  { route: 'drivers/[id]/class-periods/[periodId]', handler: classPeriod.PATCH, method: 'PATCH', options: () => ({ params: { id: a.driverId, periodId: aPeriod }, body: { to: '2026-01-01' } }) },
  { route: 'drivers/[id]/class-periods/[periodId]', handler: classPeriod.DELETE, method: 'DELETE', options: () => ({ params: { id: a.driverId, periodId: aPeriod } }) },
  { route: 'drivers/[id]/class-periods/[periodId]', handler: classPeriod.DELETE, method: 'DELETE', options: () => ({ params: { id: b.driverId, periodId: aPeriod } }) },
  { route: 'drivers/[id]/other-hours', handler: otherHours.POST, method: 'POST', options: () => ({ params: { id: a.driverId }, body: { workDate: '2026-07-06', minutes: 60 } }) },
  { route: 'drivers/[id]/other-hours/[entryId]', handler: otherHour.DELETE, method: 'DELETE', options: () => ({ params: { id: a.driverId, entryId: aPeriod } }) },
  { route: 'drivers/import', handler: driverImport.POST, method: 'POST', options: () => ({ form: filesForm({ 'drivers.csv': SAMPLE_CSV['drivers.csv'] ?? '' }, { templateId: a.templateId }) }) },
  { route: 'datasets/[id]', handler: dataset.GET, method: 'GET', options: () => ({ params: { id: a.datasetId } }) },
  { route: 'datasets/[id]/files', handler: datasetFilesRoute.POST, method: 'POST', options: () => ({ params: { id: a.datasetId }, form: filesForm({ 'hours.csv': 'Driver,Date,Hours\nD1,2026-07-06,1' }) }) },
  { route: 'datasets/[id]/files', handler: datasetFilesRoute.DELETE, method: 'DELETE', options: () => ({ params: { id: a.datasetId } }) },
  { route: 'datasets/[id]/check', handler: datasetCheck.POST, method: 'POST', options: () => ({ params: { id: a.datasetId }, body: { templateId: a.templateId } }) },
  { route: 'datasets/[id]/check', handler: datasetCheck.POST, method: 'POST', options: () => ({ params: { id: b.datasetId }, body: { templateId: a.templateId } }) },
  { route: 'datasets/[id]/check', handler: datasetCheck.POST, method: 'POST', options: () => ({ params: { id: a.datasetId }, body: { templateId: b.templateId } }) },
  { route: 'uploads/[id]', handler: upload.GET, method: 'GET', options: () => ({ params: { id: aUpload } }) },
  { route: 'templates/[id]', handler: template.GET, method: 'GET', options: () => ({ params: { id: a.templateId } }) },
  { route: 'runs', handler: runsRoute.POST, method: 'POST', options: () => ({ body: { datasetId: a.datasetId, templateId: a.templateId, asOf: '2026-11-16' } }) },
  { route: 'runs', handler: runsRoute.POST, method: 'POST', options: () => ({ body: { datasetId: b.datasetId, templateId: a.templateId, asOf: '2026-11-16' } }) },
  { route: 'runs', handler: runsRoute.POST, method: 'POST', options: () => ({ body: { datasetId: a.datasetId, templateId: b.templateId, asOf: '2026-11-16' } }) },
  { route: 'runs/[id]', handler: run.GET, method: 'GET', options: () => ({ params: { id: a.runId } }) },
  { route: 'runs/[id]/recompute', handler: runRecompute.POST, method: 'POST', options: () => ({ params: { id: a.runId } }) },
  { route: 'runs/[id]/reports', handler: runReports.GET, method: 'GET', options: () => ({ params: { id: a.runId } }) },
  { route: 'runs/[id]/reports', handler: runReports.POST, method: 'POST', options: () => ({ params: { id: a.runId } }) },
  { route: 'reports/[id]', handler: report.GET, method: 'GET', options: () => ({ params: { id: a.reportId } }) },
  { route: 'org/members/[userId]', handler: orgMember.PATCH, method: 'PATCH', options: () => ({ params: { userId: aUser }, body: { role: 'viewer' } }) },
  { route: 'org/members/[userId]', handler: orgMember.DELETE, method: 'DELETE', options: () => ({ params: { userId: aUser } }) },
  { route: 'session/organization', handler: sessionOrg.POST, method: 'POST', options: () => ({ body: { organizationId: aOrg } }) },
];

// Routes with no identifier: what B sees must contain nothing of A's.
const lists = (): { route: string; handler: Handler }[] => [
  { route: 'drivers', handler: drivers.GET }, { route: 'datasets', handler: datasets.GET }, { route: 'templates', handler: templates.GET },
  { route: 'runs', handler: runsRoute.GET }, { route: 'org', handler: org.GET }, { route: 'org/invitations', handler: orgInvitations.GET },
  { route: 'org/audit', handler: orgAudit.GET }, { route: 'org/export', handler: orgExport.GET },
];

// Not organization data: sign-in, sign-out, health, and accepting an invitation by its secret token.
const NOT_TENANT = ['auth/login', 'auth/logout', 'auth/signup', 'health', 'invitations/accept'];

describe('cross-organization access', () => {
  it('every identifier route answers "not found" to another organization, exactly as for an id that does not exist', async () => {
    for (const x of attacks()) {
      const r: Reply = await call(x.handler, x.method, `/api/${x.route}?name=hours.csv`, { ...x.options(), cookie: b.cookie });
      expect([x.route, x.method, r.status, r.body['code']]).toEqual([x.route, x.method, 404, 'not_found']);
      expect(new TextDecoder().decode(r.bytes)).not.toMatch(/Alpha|D1,|alpha\.example/);
    }
  });
  it('the same calls succeed for the organization that owns the data, so the 404s above are not accidents', async () => {
    const own = attacks().filter(x => x.method === 'GET' || x.route === 'datasets/[id]/check' || x.route === 'runs/[id]/recompute');
    for (const x of own.filter(x => !JSON.stringify(x.options()).includes(b.datasetId) && !JSON.stringify(x.options()).includes(b.templateId))) {
      const r = await call(x.handler, x.method, `/api/${x.route}`, { ...x.options(), cookie: a.cookie });
      expect([x.route, x.method, r.status]).toEqual([x.route, x.method, 200]);
    }
  });
  it('nothing of A was changed by B\'s attempts', async () => {
    const d = await call(driver.GET, 'GET', '/x', { cookie: a.cookie, params: { id: a.driverId } });
    expect(Object(d.body['driver']).externalId).toBe('D1');
    expect(Object(d.body['driver']).classPeriods.length).toBe(1);
    const ds = await call(dataset.GET, 'GET', '/x', { cookie: a.cookie, params: { id: a.datasetId } });
    expect(Object(ds.body['dataset']).files.length).toBe(4);
    const runs = (await call(runsRoute.GET, 'GET', '/x', { cookie: a.cookie })).body['runs'];
    expect(Array.isArray(runs) ? runs.length : 0).toBe(1);
    expect(Object((await call(org.GET, 'GET', '/x', { cookie: a.cookie })).body['members']).length).toBe(1);
  });
  it('list routes show an organization only its own rows', async () => {
    for (const x of lists()) {
      const r = await call(x.handler, 'GET', `/api/${x.route}`, { cookie: b.cookie });
      const text = x.route === 'org/export' ? Buffer.from(r.bytes).toString('latin1') : new TextDecoder().decode(r.bytes);
      expect([x.route, r.status]).toEqual([x.route, 200]);
      for (const secret of [a.driverId, a.datasetId, a.templateId, a.runId, a.reportId, aUser, aOrg, 'alpha.example.test']) expect([x.route, text.includes(secret)]).toEqual([x.route, false]);
    }
  });
  it('an identifier that is not a UUID is "not found", never a database error', async () => {
    const r = await call(run.GET, 'GET', '/x', { cookie: b.cookie, params: { id: "1' or '1'='1" } });
    expect(r.status).toBe(404);
  });
});

describe('coverage of this test', () => {
  const API = fileURLToPath(new URL('../app/api', import.meta.url));
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
  const routes = walk(API).filter(f => f.endsWith('route.ts')).map(f => relative(API, f).replace(/\/route\.ts$/, ''));

  it('names every API route: a new route fails here until it is added to the attack list or the list routes', () => {
    const covered = new Set([...attacks().map(x => x.route), ...lists().map(x => x.route), ...NOT_TENANT, 'org/delete']);
    expect(routes.filter(r => !covered.has(r))).toEqual([]);
    expect(routes.length).toBe(31);
  });
  it('attacks every exported method of every identifier route', () => {
    for (const file of routes.filter(r => r.includes('['))) {
      const exported = [...readFileSync(join(API, file, 'route.ts'), 'utf8').matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)].map(m => m[1]);
      const attacked = new Set(attacks().filter(x => x.route === file).map(x => x.method));
      expect([file, exported.filter(m => !attacked.has(m ?? ''))]).toEqual([file, []]);
    }
  });

  // A static guard: in the server code, every statement that reads or changes a tenant table names organizationId.
  it('every query on a tenant table in the server code is scoped by organization', () => {
    const SERVER = fileURLToPath(new URL('../server', import.meta.url));
    const tables = Object.keys(TENANT_TABLES);
    const unscoped: string[] = [];
    for (const file of readdirSync(SERVER).filter(f => f.endsWith('.ts'))) {
      const text = readFileSync(join(SERVER, file), 'utf8');
      for (const m of text.matchAll(/\.(from|update|delete|insert|innerJoin)\((\w+)[,)]/g)) {
        if (!tables.includes(m[2] ?? '')) continue;
        const end = text.indexOf(';\n', m.index);
        const statement = text.slice(text.lastIndexOf('\n', m.index), end === -1 ? undefined : end);
        if (!/organizationId/.test(statement)) unscoped.push(`${file}: ${statement.trim().slice(0, 90)}`);
      }
    }
    // The only exceptions run before an organization is known, and look rows up by a secret token or the caller's own user id.
    expect(unscoped.filter(u => !u.startsWith('auth.ts'))).toEqual([]);
  });
});
