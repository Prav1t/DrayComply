// A demonstration organization. Every name, driver and figure is invented; nothing here comes from a real licensee.
import { eq } from 'drizzle-orm';
import { memberships, organizations, users } from '../../../packages/db/src/index';
import { SAMPLE_TABLES } from '../../../packages/ingest/src/testing/sample';
import { createRun } from './assess';
import type { Ctx } from './context';
import { hashPassword } from './crypto';
import { addFiles, createDataset } from './datasets';
import { db } from './db';
import { importDrivers } from './drivers';
import { generateReport } from './reports';
import { saveTemplate } from './templates';

export const DEMO_ORGANIZATION = 'DEMO - Fictional Drayage Ltd. (not a real company)';

const DRIVERS = [
  'Driver,Type,From,To,Employer IO,Opening Hours,Hours Complete From,Fuel,Callouts,Other Hours',
  'DEMO-DRIVER-1,Company,2020-01-01,,,0,2020-01-01,,yes,yes',
  'DEMO-DRIVER-2,Company,2020-01-01,,,0,2020-01-01,,yes,yes',
  'DEMO-OPERATOR-1,Owner Operator Trip,2020-01-01,,,,,published,yes,',
  'DEMO-OPERATOR-2,Owner Operator Trip,2020-01-01,,,,,published,yes,',
  'DEMO-OPERATOR-3,Owner Operator Trip,2020-01-01,,,,,published,yes,',
].join('\n');

// DRIVER-2 is paid under the hourly rate; OPERATOR-2's trip is paid under the trip rate; OPERATOR-3's wait time is blank.
const FILES: Readonly<Record<string, string>> = {
  'demo-periods.csv': [
    'Driver,Period,Start,End,Paid On,Payer,Wait Time',
    'DEMO-DRIVER-1,P1,2026-07-05,2026-07-18,2026-07-24,licensee,0.00',
    'DEMO-DRIVER-2,P1,2026-07-05,2026-07-18,2026-07-24,licensee,0.00',
    'DEMO-OPERATOR-1,P1,2026-07-05,2026-07-18,2026-07-24,licensee,50.00',
    'DEMO-OPERATOR-2,P1,2026-07-05,2026-07-18,2026-07-24,licensee,50.00',
    'DEMO-OPERATOR-3,P1,2026-07-05,2026-07-18,2026-07-24,licensee,',
  ].join('\n'),
  'demo-hours.csv': ['Driver,Date,Hours', 'DEMO-DRIVER-1,2026-07-06,8.5', 'DEMO-DRIVER-2,2026-07-06,8.5'].join('\n'),
  'demo-trips.csv': [
    'Driver,Trip,Date,Kind,Zone,Terminal,From Zone,To Zone,Containers',
    'DEMO-OPERATOR-1,T1,2026-07-06,Off-Dock,,,Q,S,1',
    'DEMO-OPERATOR-2,T1,2026-07-06,Off-Dock,,,Q,S,1',
    'DEMO-OPERATOR-3,T1,2026-07-06,Off-Dock,,,Q,S,1',
  ].join('\n'),
  'demo-payments.csv': [
    'Driver,Period,Type,Amount,Work From,Work To,Trip',
    'DEMO-DRIVER-1,P1,Regular,293.76,2026-07-05,2026-07-18,',
    'DEMO-DRIVER-2,P1,Regular,250.00,2026-07-05,2026-07-18,',
    ...['DEMO-OPERATOR-1', 'DEMO-OPERATOR-2', 'DEMO-OPERATOR-3'].flatMap(d => [
      `${d},P1,Trip,${d === 'DEMO-OPERATOR-2' ? '120.00' : '139.00'},2026-07-05,2026-07-18,T1`,
      `${d},P1,PMR,25.00,2026-07-05,2026-07-18,`,
      `${d},P1,Fuel,63.94,2026-07-05,2026-07-18,`,
      `${d},P1,Wait,50.00,2026-07-05,2026-07-18,`,
    ]),
  ].join('\n'),
};

const NONE = { kind: 'none' } as const;
const retarget = (table: unknown, file: string): unknown => ({ ...Object(table), file });
const DRIVER_TEMPLATE = { id: 'demo-drivers', name: 'Demo driver list', version: 1, tables: { drivers: retarget(SAMPLE_TABLES['drivers'], 'demo-drivers.csv'), payPeriods: NONE, hours: NONE, trips: NONE, payments: NONE, deductions: NONE, callouts: NONE, otherLicenseeHours: NONE, fuelPrices: NONE } };
const RECORDS_TEMPLATE = { id: 'demo-records', name: 'Demo payroll exports', version: 1, tables: {
  drivers: NONE, otherLicenseeHours: NONE, deductions: NONE, callouts: NONE, fuelPrices: NONE,
  payPeriods: retarget(SAMPLE_TABLES['payPeriods'], 'demo-periods.csv'), hours: retarget(SAMPLE_TABLES['hours'], 'demo-hours.csv'),
  trips: retarget(SAMPLE_TABLES['trips'], 'demo-trips.csv'), payments: retarget(SAMPLE_TABLES['payments'], 'demo-payments.csv'),
} };

export type SeedResult = { readonly kind: 'exists' } | { readonly kind: 'created'; readonly organizationId: string; readonly runId: string };

// Builds the demo through the same functions the app uses, so it exercises the real pipeline. Does nothing if the account exists.
export async function seedDemo(email: string, password: string, now: Date): Promise<SeedResult> {
  const [existing] = await db().select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase()));
  if (existing !== undefined) return { kind: 'exists' };
  const passwordHash = await hashPassword(password);
  const ctx: Ctx = await db().transaction(async tx => {
    const [user] = await tx.insert(users).values({ email: email.toLowerCase(), name: 'Demo Owner', passwordHash }).returning({ id: users.id });
    const [org] = await tx.insert(organizations).values({ name: DEMO_ORGANIZATION, isDemo: true }).returning({ id: organizations.id });
    if (user === undefined || org === undefined) throw new Error('demo account insert returned nothing');
    await tx.insert(memberships).values({ organizationId: org.id, userId: user.id, role: 'owner' });
    return { organizationId: org.id, userId: user.id, role: 'owner', now };
  });
  const text = (s: string): Uint8Array => new TextEncoder().encode(s);
  const imported = await importDrivers(ctx, [{ name: 'demo-drivers.csv', format: 'csv', bytes: text(DRIVERS) }], DRIVER_TEMPLATE);
  if (imported.kind !== 'imported') throw new Error(`demo drivers were refused: ${imported.errors.join('; ')}`);
  const dataset = await createDataset(ctx, 'DEMO - July 2026 (fictional)');
  await addFiles(ctx, dataset.id, Object.entries(FILES).map(([name, body]) => ({ name, bytes: text(body) })));
  const template = await saveTemplate(ctx, RECORDS_TEMPLATE, 'records');
  const run = await createRun(ctx, { datasetId: dataset.id, templateId: template.id, asOf: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver' }).format(now), periods: { kind: 'all' }, drivers: { kind: 'all' } });
  if (run.status !== 'completed') throw new Error('the demo run stopped');
  await generateReport(ctx, run.id);
  return { kind: 'created', organizationId: ctx.organizationId, runId: run.id };
}
