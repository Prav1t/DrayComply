// Sign-up, sign-in, sessions, rate limiting, roles and invitations.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { sessions, users } from '../../../packages/db/src/index';
import { POST as signup } from '../app/api/auth/signup/route';
import { POST as login } from '../app/api/auth/login/route';
import { POST as logout } from '../app/api/auth/logout/route';
import { GET as listDrivers, POST as createDriver } from '../app/api/drivers/route';
import { POST as createDataset } from '../app/api/datasets/route';
import { POST as inviteRoute, GET as listInvites } from '../app/api/org/invitations/route';
import { PATCH as setRole, DELETE as removeMember } from '../app/api/org/members/[userId]/route';
import { GET as exportOrg } from '../app/api/org/export/route';
import { POST as deleteOrg } from '../app/api/org/delete/route';
import { GET as audit } from '../app/api/org/audit/route';
import { GET as org } from '../app/api/org/route';
import { resetEnvForTests } from '../server/env';
import { call, cookieOf, world, type World } from './harness';
import { PASSWORD, account } from './setup';

let w: World;
beforeAll(async () => { w = await world(); });
afterAll(async () => { await w.close(); });

const signIn = (email: string, password: string, address = '198.51.100.1') => call(login, 'POST', '/api/auth/login', { body: { email, password }, address });

describe('accounts', () => {
  it('signs up, stores a salted scrypt hash, and sets an HttpOnly SameSite session cookie', async () => {
    const r = await call(signup, 'POST', '/api/auth/signup', { body: { email: 'Owner@One.Example.Test', name: 'O', password: PASSWORD, organizationName: 'One Ltd.' } });
    expect(r.status).toBe(201);
    expect(r.headers.get('set-cookie')).toMatch(/^dc_session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=1209600$/);
    const [u] = await w.t.db.select().from(users).where(eq(users.email, 'owner@one.example.test'));
    expect(u?.passwordHash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(u?.passwordHash).not.toContain(PASSWORD);
  });
  it('stores only a hash of the session token', async () => {
    const cookie = await account('hash@two.example.test', 'Two Ltd.');
    const token = cookie.split('=')[1] ?? '';
    const rows = await w.t.db.select().from(sessions);
    expect(rows.some(s => s.tokenHash === token)).toBe(false);
  });
  it('marks the cookie Secure when the site is served over https', async () => {
    process.env['APP_URL'] = 'https://app.example.test';
    resetEnvForTests();
    const r = await call(signup, 'POST', '/api/auth/signup', { body: { email: 'secure@x.example.test', name: 'S', password: PASSWORD, organizationName: 'S Ltd.' }, origin: 'https://app.example.test' });
    process.env['APP_URL'] = 'http://localhost:3000';
    resetEnvForTests();
    expect(r.headers.get('set-cookie')).toContain('; Secure');
  });
  it('refuses a short password and a duplicate email, without saying the email exists', async () => {
    const short = await call(signup, 'POST', '/api/auth/signup', { body: { email: 'short@x.example.test', name: 'S', password: 'elevenchars', organizationName: 'X' } });
    expect(String(short.body['error'])).toContain('at least 12 characters');
    const dup = await call(signup, 'POST', '/api/auth/signup', { body: { email: 'owner@one.example.test', name: 'S', password: PASSWORD, organizationName: 'X' } });
    expect(dup.status).toBe(400);
    expect(String(dup.body['error'])).not.toMatch(/exists|taken|already/);
  });
  it('signs in with the right password only, with the same answer for a wrong password and an unknown email', async () => {
    expect((await signIn('owner@one.example.test', PASSWORD)).status).toBe(200);
    const wrong = await signIn('owner@one.example.test', 'not the password!', '198.51.100.2');
    const unknown = await signIn('nobody@one.example.test', 'not the password!', '198.51.100.3');
    expect([wrong.status, unknown.status]).toEqual([401, 401]);
    expect(wrong.body['error']).toBe(unknown.body['error']);
  });
  it('signing out ends the session on the server', async () => {
    const cookie = cookieOf(await signIn('owner@one.example.test', PASSWORD, '198.51.100.4'));
    expect((await call(listDrivers, 'GET', '/api/drivers', { cookie })).status).toBe(200);
    await call(logout, 'POST', '/api/auth/logout', { cookie });
    expect((await call(listDrivers, 'GET', '/api/drivers', { cookie })).status).toBe(401);
  });
  it('an expired session is refused', async () => {
    const cookie = await account('expired@three.example.test', 'Three Ltd.');
    await w.t.pool.query(`update sessions set expires_at = now() - interval '1 minute' where user_id = (select id from users where email = 'expired@three.example.test')`);
    expect((await call(listDrivers, 'GET', '/api/drivers', { cookie })).status).toBe(401);
  });
  it('refuses every data route without a session, and with a made-up cookie', async () => {
    expect((await call(listDrivers, 'GET', '/api/drivers')).status).toBe(401);
    expect((await call(listDrivers, 'GET', '/api/drivers', { cookie: 'dc_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' })).status).toBe(401);
  });
});

describe('rate limiting and request origin', () => {
  it('locks sign-in for an email after ten attempts in the window, even with the right password', async () => {
    const email = 'limited@four.example.test';
    await account(email, 'Four Ltd.');
    for (let i = 0; i < 10; i += 1) expect((await signIn(email, 'wrong password!!', `198.51.100.${50 + i}`)).status).toBe(401);
    const locked = await signIn(email, PASSWORD, '198.51.100.99');
    expect(locked.status).toBe(429);
    expect(String(locked.body['error'])).toContain('Too many attempts');
  });
  it('locks sign-in from one address after thirty attempts, whatever the email', async () => {
    let last = 0;
    for (let i = 0; i < 31; i += 1) last = (await signIn(`spray${i}@five.example.test`, 'wrong password!!', '192.0.2.200')).status;
    expect(last).toBe(429);
  });
  it('limits sign-ups from one address', async () => {
    let last = 0;
    for (let i = 0; i < 11; i += 1) last = (await call(signup, 'POST', '/api/auth/signup', { body: { email: `bulk${i}@six.example.test`, name: 'B', password: PASSWORD, organizationName: 'B' }, address: '192.0.2.201' })).status;
    expect(last).toBe(429);
  });
  it('refuses a state-changing request from another origin, or with no Origin header', async () => {
    const cookie = await account('origin@seven.example.test', 'Seven Ltd.', '192.0.2.10');
    expect((await call(createDataset, 'POST', '/api/datasets', { cookie, body: { name: 'x' }, origin: 'https://evil.example' })).status).toBe(403);
    expect((await call(createDataset, 'POST', '/api/datasets', { cookie, body: { name: 'x' }, origin: null })).status).toBe(403);
    expect((await call(createDataset, 'POST', '/api/datasets', { cookie, body: { name: 'x' } })).status).toBe(201);
  });
});

describe('roles and invitations', () => {
  let owner = '';
  let payroll = '';
  let viewer = '';

  const join = async (email: string, role: string): Promise<string> => {
    const inv = await call(inviteRoute, 'POST', '/api/org/invitations', { cookie: owner, body: { email, role } });
    const token = new URL(String(inv.body['link'])).searchParams.get('invite') ?? '';
    const r = await call(signup, 'POST', '/api/auth/signup', { body: { email, name: role, password: PASSWORD, invite: token }, address: '192.0.2.20' });
    expect(r.status).toBe(201);
    return cookieOf(r);
  };

  beforeAll(async () => {
    owner = await account('owner@eight.example.test', 'Eight Ltd.', '192.0.2.21');
    payroll = await join('payroll@eight.example.test', 'payroll');
    viewer = await join('viewer@eight.example.test', 'viewer');
  });

  it('an invitation joins the inviting organization with the invited role, once', async () => {
    const members = (await call(org, 'GET', '/api/org', { cookie: viewer })).body['members'];
    expect(JSON.stringify(members)).toContain('"email":"payroll@eight.example.test","name":"payroll","role":"payroll"');
    expect((await call(listInvites, 'GET', '/api/org/invitations', { cookie: owner })).body['invitations']).toEqual([]);
  });
  it('an invitation cannot be used by a different email address', async () => {
    const inv = await call(inviteRoute, 'POST', '/api/org/invitations', { cookie: owner, body: { email: 'meant@eight.example.test', role: 'owner' } });
    const token = new URL(String(inv.body['link'])).searchParams.get('invite') ?? '';
    const r = await call(signup, 'POST', '/api/auth/signup', { body: { email: 'thief@eight.example.test', name: 'T', password: PASSWORD, invite: token }, address: '192.0.2.22' });
    expect(r.status).toBe(400);
  });
  it('a viewer can read but not change anything', async () => {
    expect((await call(listDrivers, 'GET', '/api/drivers', { cookie: viewer })).status).toBe(200);
    expect((await call(createDriver, 'POST', '/api/drivers', { cookie: viewer, body: { externalId: 'V1' } })).status).toBe(403);
    expect((await call(createDataset, 'POST', '/api/datasets', { cookie: viewer, body: { name: 'x' } })).status).toBe(403);
  });
  it('payroll can work with data but cannot manage members, export or delete the organization', async () => {
    expect((await call(createDriver, 'POST', '/api/drivers', { cookie: payroll, body: { externalId: 'P1' } })).status).toBe(201);
    expect((await call(inviteRoute, 'POST', '/api/org/invitations', { cookie: payroll, body: { email: 'x@y.example.test', role: 'viewer' } })).status).toBe(403);
    expect((await call(exportOrg, 'GET', '/api/org/export', { cookie: payroll })).status).toBe(403);
    expect((await call(deleteOrg, 'POST', '/api/org/delete', { cookie: payroll, body: { confirmName: 'Eight Ltd.' } })).status).toBe(403);
    expect((await call(audit, 'GET', '/api/org/audit', { cookie: payroll })).status).toBe(403);
  });
  it('a role change takes effect on the very next request', async () => {
    const [u] = await w.t.db.select().from(users).where(eq(users.email, 'payroll@eight.example.test'));
    await call(setRole, 'PATCH', `/api/org/members/${u?.id}`, { cookie: owner, params: { userId: u?.id ?? '' }, body: { role: 'viewer' } });
    expect((await call(createDriver, 'POST', '/api/drivers', { cookie: payroll, body: { externalId: 'P2' } })).status).toBe(403);
  });
  it('the last owner cannot be demoted or removed; a removed member loses access at once', async () => {
    const [o] = await w.t.db.select().from(users).where(eq(users.email, 'owner@eight.example.test'));
    const [v] = await w.t.db.select().from(users).where(eq(users.email, 'viewer@eight.example.test'));
    expect((await call(setRole, 'PATCH', '/x', { cookie: owner, params: { userId: o?.id ?? '' }, body: { role: 'viewer' } })).status).toBe(400);
    expect((await call(removeMember, 'DELETE', '/x', { cookie: owner, params: { userId: o?.id ?? '' } })).status).toBe(400);
    expect((await call(removeMember, 'DELETE', '/x', { cookie: owner, params: { userId: v?.id ?? '' } })).status).toBe(200);
    expect((await call(listDrivers, 'GET', '/api/drivers', { cookie: viewer })).status).toBe(409);
  });
});

describe('closed sign-up', () => {
  it('refuses a new organization without an invitation when sign-up is not open', async () => {
    process.env['SIGNUP_OPEN'] = 'false';
    resetEnvForTests();
    const r = await call(signup, 'POST', '/api/auth/signup', { body: { email: 'walkin@nine.example.test', name: 'W', password: PASSWORD, organizationName: 'Nine' }, address: '192.0.2.30' });
    process.env['SIGNUP_OPEN'] = 'true';
    resetEnvForTests();
    expect([r.status, r.body['code']]).toEqual([403, 'signup_closed']);
  });
});
