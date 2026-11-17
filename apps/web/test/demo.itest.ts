// The demonstration organization, built through the real pipeline.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { organizations, reports, runs } from '../../../packages/db/src/index';
import { POST as login } from '../app/api/auth/login/route';
import { GET as getRun } from '../app/api/runs/[id]/route';
import { purgeExpired } from '../server/auth';
import { DEMO_ORGANIZATION, seedDemo } from '../server/demo';
import { call, cookieOf, world, type World } from './harness';

let w: World;
beforeAll(async () => { w = await world(false); });
afterAll(async () => { await w.close(); });

describe('demo organization', () => {
  it('shows one of each outcome on verified rates only, is marked as a demo, and seeding twice changes nothing', async () => {
    const now = new Date('2026-11-16T20:00:00Z');
    const seeded = await seedDemo('demo@draycomply.example.test', 'a long demo password', now);
    if (seeded.kind !== 'created') throw new Error('demo was not created');
    expect(await seedDemo('demo@draycomply.example.test', 'a long demo password', now)).toEqual({ kind: 'exists' });
    const [org] = await w.t.db.select().from(organizations).where(eq(organizations.id, seeded.organizationId));
    expect([org?.name, org?.isDemo]).toEqual([DEMO_ORGANIZATION, true]);
    const [run] = await w.t.db.select().from(runs).where(eq(runs.id, seeded.runId));
    expect(run?.unverifiedSchedulesUsed).toBe(false);
    expect((await w.t.db.select({ w: reports.watermarked }).from(reports).where(eq(reports.runId, seeded.runId)))[0]?.w).toBe(false);

    const cookie = cookieOf(await call(login, 'POST', '/api/auth/login', { body: { email: 'demo@draycomply.example.test', password: 'a long demo password' } }));
    const body = (await call(getRun, 'GET', '/x', { cookie, params: { id: seeded.runId } })).body;
    const drivers: unknown[] = Object(Object(Object(body['run']).outcome).run).drivers;
    expect(drivers.map(d => [Object(d).driverId, Object(d).verdict])).toEqual([
      ['DEMO-DRIVER-1', 'no_shortfall_detected'], ['DEMO-DRIVER-2', 'shortfall_aggregate'], ['DEMO-OPERATOR-1', 'no_shortfall_detected'],
      ['DEMO-OPERATOR-2', 'shortfall_aggregate'], ['DEMO-OPERATOR-3', 'insufficient_data'],
    ]);
  });
  it('housekeeping removes only expired sessions', async () => {
    await w.t.pool.query(`insert into sessions (user_id, token_hash, expires_at) select id, 'old', now() - interval '1 day' from users limit 1`);
    const removed = await purgeExpired(new Date());
    expect(removed.sessions).toBe(1);
    expect((await w.t.pool.query('select count(*)::int as n from sessions')).rows[0]?.n).toBe(1);
  });
});
