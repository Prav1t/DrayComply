// Calls route handlers directly, against a real Postgres, the way the server would.
import { createTestDatabase, type TestDatabase } from '../../../packages/db/src/testing';
import { SAMPLE_CSV, SAMPLE_TABLES, sampleTemplate } from '../../../packages/ingest/src/testing/sample';
import { setDatabaseForTests } from '../server/db';
import { resetEnvForTests } from '../server/env';
import { setLogSinkForTests } from '../server/log';

export const ORIGIN = 'http://localhost:3000';
type Handler = (req: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

export interface World { readonly t: TestDatabase; readonly logs: string[]; readonly close: () => Promise<void> }

export async function world(signupOpen = true): Promise<World> {
  const t = await createTestDatabase();
  process.env['DATABASE_URL'] = t.url;
  process.env['APP_URL'] = ORIGIN;
  process.env['SIGNUP_OPEN'] = signupOpen ? 'true' : 'false';
  delete process.env['ERROR_WEBHOOK_URL'];
  resetEnvForTests();
  setDatabaseForTests(t);
  const logs: string[] = [];
  setLogSinkForTests(line => logs.push(line));
  return { t, logs, close: async () => { setDatabaseForTests(null); setLogSinkForTests(null); await t.drop(); } };
}

export interface CallOptions {
  readonly cookie?: string;
  readonly body?: unknown;
  readonly form?: FormData;
  readonly params?: Record<string, string>;
  readonly origin?: string | null;
  readonly address?: string;
}

export interface Reply { readonly status: number; readonly body: Record<string, unknown>; readonly bytes: Uint8Array; readonly headers: Headers }

export async function call(handler: Handler, method: string, path: string, o: CallOptions = {}): Promise<Reply> {
  const headers = new Headers();
  if (o.cookie !== undefined) headers.set('cookie', o.cookie);
  if (o.origin !== null && method !== 'GET') headers.set('origin', o.origin ?? ORIGIN);
  headers.set('x-forwarded-for', o.address ?? '203.0.113.7');
  let body: BodyInit | null = null;
  if (o.form !== undefined) body = o.form;
  else if (o.body !== undefined) { body = JSON.stringify(o.body); headers.set('content-type', 'application/json'); }
  const res = await handler(new Request(`${ORIGIN}${path}`, { method, headers, body }), { params: Promise.resolve(o.params ?? {}) });
  const bytes = new Uint8Array(await res.arrayBuffer());
  let parsed: Record<string, unknown> = {};
  if ((res.headers.get('content-type') ?? '').includes('json')) parsed = Object.fromEntries(Object.entries(JSON.parse(new TextDecoder().decode(bytes))));
  return { status: res.status, body: parsed, bytes, headers: res.headers };
}

export const cookieOf = (r: Reply): string => (r.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
export const idOf = (r: Reply): string => { const id = r.body['id']; if (typeof id !== 'string') throw new Error(`no id in reply: ${JSON.stringify(r.body)}`); return id; };

export const filesForm = (files: Record<string, string | Uint8Array>, fields: Record<string, string> = {}): FormData => {
  const form = new FormData();
  Object.entries(files).forEach(([name, content]) => form.append('file', new File([typeof content === 'string' ? content : new Uint8Array(content)], name)));
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  return form;
};

const NONE = { kind: 'none' } as const;
// Drivers come from the roster, so a records template declares both driver tables "none".
export const recordsTemplate = (tables: Record<string, unknown> = {}, id = 'records'): unknown =>
  ({ ...Object(sampleTemplate()), id, name: 'Records', tables: { ...SAMPLE_TABLES, drivers: NONE, otherLicenseeHours: NONE, ...tables } });
export const driversTemplate = (): unknown => ({
  id: 'driver-import', name: 'Driver import', version: 1,
  tables: { drivers: SAMPLE_TABLES['drivers'], payPeriods: NONE, hours: NONE, trips: NONE, payments: NONE, deductions: NONE, callouts: NONE, otherLicenseeHours: NONE, fuelPrices: NONE },
});
export const RECORD_FILES: Record<string, string> = Object.fromEntries(Object.entries(SAMPLE_CSV).filter(([name]) => name !== 'drivers.csv'));
export const DRIVERS_CSV = SAMPLE_CSV['drivers.csv'] ?? '';
