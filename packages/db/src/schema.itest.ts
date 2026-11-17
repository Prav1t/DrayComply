// The data layer against a real Postgres: tenancy columns, cross-organization references, immutability.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { IMMUTABLE_TABLES, datasets, drivers, driverClassPeriods, mappingTemplates, organizations, reports, runResults, runs, uploads, users, auditLog } from './schema';
import { createTestDatabase, type TestDatabase } from './testing';

let t: TestDatabase;
let orgA = '';
let orgB = '';
let user = '';
let runId = '';

const refused = async (work: () => Promise<unknown>): Promise<string> => {
  try { await work(); return 'allowed'; } catch (e) {
    const cause = e instanceof Error && e.cause instanceof Error ? e.cause : e;
    return cause instanceof Error ? cause.message : String(e);
  }
};

beforeAll(async () => {
  t = await createTestDatabase();
  const [a, b] = await t.db.insert(organizations).values([{ name: 'Org A' }, { name: 'Org B' }]).returning();
  const [u] = await t.db.insert(users).values({ email: 'a@example.test', name: 'A', passwordHash: 'x' }).returning();
  orgA = a?.id ?? ''; orgB = b?.id ?? ''; user = u?.id ?? '';
  const [ds] = await t.db.insert(datasets).values({ organizationId: orgA, name: 'July', createdBy: user }).returning();
  const [tpl] = await t.db.insert(mappingTemplates).values({ organizationId: orgA, templateKey: 'k', name: 'T', version: 1, purpose: 'records', body: {}, sha256: 'h', createdBy: user }).returning();
  await t.db.insert(uploads).values({ organizationId: orgA, kind: 'source', name: 'a.csv', format: 'csv', sha256: 'h', sizeBytes: 1, content: Buffer.from('a'), uploadedBy: user });
  const [run] = await t.db.insert(runs).values({
    organizationId: orgA, datasetId: ds?.id ?? '', templateId: tpl?.id ?? '', createdBy: user, status: 'completed', asOf: '2026-11-16', rounding: 'half_up',
    periodSelection: { kind: 'all' }, driverSelection: { kind: 'all' }, engineVersion: '0', deductionPolicyId: 'p', scheduleIds: [], unverifiedSchedulesUsed: false,
    pendingInterpretationIds: [], inputFiles: [], summary: {},
  }).returning();
  runId = run?.id ?? '';
  await t.db.insert(runResults).values({ runId, organizationId: orgA, engineInput: {}, ingest: {}, result: {}, resultSha256: 'h' });
  await t.db.insert(reports).values({ organizationId: orgA, runId, createdBy: user, generatedAt: '2026-11-16T20:00:00Z', sha256: 'h', sizeBytes: 1, watermarked: false, pendingLegalReview: true, content: Buffer.from('p') });
  await t.db.insert(auditLog).values({ organizationId: orgA, userId: user, action: 'run.created', entity: 'run', entityId: runId, detail: {} });
});
afterAll(async () => { await t.drop(); });

describe('tenancy in the schema', () => {
  it('every table except the account tables carries a NOT NULL organization_id', async () => {
    const res = await t.pool.query<{ table_name: string; has: boolean }>(`
      select t.table_name, exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name
        and c.column_name = 'organization_id' and c.is_nullable = 'NO') as has
      from information_schema.tables t where t.table_schema = 'public' and t.table_type = 'BASE TABLE' order by 1`);
    const without = res.rows.filter(r => !r.has).map(r => r.table_name);
    expect(without).toEqual(['auth_attempts', 'organizations', 'sessions', 'users']);
    expect(res.rows.length).toBe(18);
  });
  it('refuses a class period that points at another organization\'s driver', async () => {
    const [d] = await t.db.insert(drivers).values({ organizationId: orgA, externalId: 'D1' }).returning();
    const outcome = await refused(() => t.db.insert(driverClassPeriods).values({ organizationId: orgB, driverId: d?.id ?? '', class: 'DEO', fromDate: '2020-01-01' }));
    expect(outcome).toContain('class_periods_driver');
  });
  it('refuses an IEO period with no employing I/O, and an employer on any other class', async () => {
    const [d] = await t.db.insert(drivers).values({ organizationId: orgA, externalId: 'D2' }).returning();
    expect(await refused(() => t.db.insert(driverClassPeriods).values({ organizationId: orgA, driverId: d?.id ?? '', class: 'IEO', fromDate: '2020-01-01' }))).toContain('class_periods_ieo_employer');
    expect(await refused(() => t.db.insert(driverClassPeriods).values({ organizationId: orgA, driverId: d?.id ?? '', class: 'DEO', employingIoDriverId: d?.id ?? '', fromDate: '2020-01-01' }))).toContain('class_periods_ieo_employer');
  });
  it('reads dates back as the text that was stored', async () => {
    const [d] = await t.db.insert(drivers).values({ organizationId: orgA, externalId: 'D3', hourlyCoverageFrom: '2026-07-05' }).returning();
    expect(d?.hourlyCoverageFrom).toBe('2026-07-05');
    expect(d?.openingCumulativeMinutes).toBeNull();
  });
});

describe('immutability', () => {
  it('covers the six append-only tables', () => {
    expect([...IMMUTABLE_TABLES]).toEqual(['uploads', 'mapping_templates', 'runs', 'run_results', 'reports', 'audit_log']);
  });
  for (const table of IMMUTABLE_TABLES) {
    it(`refuses UPDATE, DELETE and TRUNCATE on ${table}`, async () => {
      const column = table === 'run_results' ? 'result_sha256' : table === 'audit_log' ? 'action' : table === 'runs' ? 'rounding' : table === 'reports' ? 'sha256' : 'name';
      expect(await refused(() => t.pool.query(`update ${table} set ${column} = 'changed'`))).toContain(`rows in ${table} are immutable: UPDATE refused`);
      expect(await refused(() => t.pool.query(`delete from ${table}`))).toContain(`rows in ${table} are immutable: DELETE refused`);
      expect(await refused(() => t.pool.query(`truncate ${table} cascade`))).toContain('append-only: TRUNCATE refused');
    });
  }
  it('a stored run cannot be altered through the ORM either', async () => {
    expect(await refused(() => t.db.update(runs).set({ status: 'stopped' }).where(eq(runs.id, runId)))).toContain('immutable');
    expect(await refused(() => t.db.update(runResults).set({ result: { forged: true } }).where(eq(runResults.runId, runId)))).toContain('immutable');
    const [row] = await t.db.select().from(runResults).where(eq(runResults.runId, runId));
    expect(row?.result).toEqual({});
  });
  it('deleting an organization is refused without the purge setting, and removes everything with it', async () => {
    expect(await refused(() => t.db.delete(organizations).where(eq(organizations.id, orgA)))).toContain('immutable');
    await t.db.transaction(async tx => {
      await tx.execute(sql`set local draycomply.purge = 'on'`);
      await tx.delete(organizations).where(eq(organizations.id, orgA));
    });
    for (const table of ['runs', 'run_results', 'reports', 'uploads', 'mapping_templates', 'audit_log', 'drivers', 'datasets']) {
      const res = await t.pool.query<{ n: string }>(`select count(*) as n from ${table}`);
      expect([table, res.rows[0]?.n]).toEqual([table, '0']);
    }
    // The setting was local to that transaction: the next delete is refused again.
    await t.db.insert(auditLog).values({ organizationId: orgB, userId: user, action: 'x', entity: 'y', detail: {} });
    expect(await refused(() => t.pool.query('delete from audit_log'))).toContain('immutable');
  });
});
