// Accounts, sessions and sign-in rate limiting.
import { and, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import { authAttempts, invitations, memberships, organizations, sessions, users, type Role } from '../../../packages/db/src/index';
import { db } from './db';
import { env } from './env';
import { AppError, invalid, pgCode } from './errors';
import { hashPassword, newToken, sha256Hex, verifyPassword } from './crypto';
import { LIMITS } from './limits';

export const SESSION_COOKIE = 'dc_session';
const DAY_MS = 86_400_000;

export interface Session {
  readonly sessionId: string;
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly activeOrganizationId: string | null;
}

export const normaliseEmail = (email: string): string => email.trim().toLowerCase();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkCredentials(email: string, password: string): void {
  if (!EMAIL.test(email) || email.length > LIMITS.maxTextLength) throw invalid('Enter a valid email address.');
  if (password.length < LIMITS.passwordMinLength) throw invalid(`The password must be at least ${LIMITS.passwordMinLength} characters.`);
  if (password.length > LIMITS.passwordMaxLength) throw invalid('The password is too long.');
}

// Counts this attempt, then refuses if the key is over its limit for the window. Keys are hashes.
export async function rateLimit(kind: string, subject: string, limit: number, now: Date): Promise<void> {
  const key = sha256Hex(`${kind}:${subject}`);
  const since = new Date(now.getTime() - LIMITS.attemptWindowMinutes * 60_000).toISOString();
  await db().insert(authAttempts).values({ key, at: now.toISOString() });
  const [row] = await db().select({ n: sql<number>`count(*)::int` }).from(authAttempts).where(and(eq(authAttempts.key, key), gt(authAttempts.at, since)));
  if ((row?.n ?? 0) > limit) throw new AppError(429, 'rate_limited', `Too many attempts. Try again in ${LIMITS.attemptWindowMinutes} minutes.`);
}

async function openSession(userId: string, activeOrganizationId: string | null, now: Date): Promise<string> {
  const token = newToken();
  await db().insert(sessions).values({ userId, tokenHash: sha256Hex(token), activeOrganizationId, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + LIMITS.sessionDays * DAY_MS).toISOString() });
  return token;
}

export interface SignUpInput { readonly email: string; readonly name: string; readonly password: string; readonly organizationName: string | null; readonly invitationToken: string | null }

// With an invitation the account joins that organization. Without one it creates a new organization, if sign-up is open.
export async function signUp(input: SignUpInput, address: string, now: Date): Promise<{ token: string }> {
  await rateLimit('signup:address', address, LIMITS.signupAttemptsPerAddress, now);
  const email = normaliseEmail(input.email);
  checkCredentials(email, input.password);
  const name = input.name.trim();
  if (name === '' || name.length > LIMITS.maxTextLength) throw invalid('Enter your name.');
  const invite = input.invitationToken === null ? null : await findInvitation(input.invitationToken, now);
  if (input.invitationToken !== null && invite === null) throw invalid('This invitation is not valid or has expired.');
  if (invite !== null && invite.email !== email) throw invalid('This invitation was issued to a different email address.');
  const organizationName = (input.organizationName ?? '').trim();
  if (invite === null) {
    if (!env().signupOpen) throw new AppError(403, 'signup_closed', 'Sign-up is by invitation only.');
    if (organizationName === '' || organizationName.length > LIMITS.maxTextLength) throw invalid('Enter the name of your company.');
  }
  const passwordHash = await hashPassword(input.password);
  try {
    const result = await db().transaction(async tx => {
      const [user] = await tx.insert(users).values({ email, name, passwordHash }).returning({ id: users.id });
      if (user === undefined) throw new Error('user insert returned nothing');
      if (invite !== null) {
        await tx.insert(memberships).values({ organizationId: invite.organizationId, userId: user.id, role: invite.role });
        await tx.update(invitations).set({ acceptedAt: now.toISOString() }).where(and(eq(invitations.id, invite.id), eq(invitations.organizationId, invite.organizationId)));
        return { userId: user.id, organizationId: invite.organizationId };
      }
      const [org] = await tx.insert(organizations).values({ name: organizationName }).returning({ id: organizations.id });
      if (org === undefined) throw new Error('organization insert returned nothing');
      await tx.insert(memberships).values({ organizationId: org.id, userId: user.id, role: 'owner' });
      return { userId: user.id, organizationId: org.id };
    });
    return { token: await openSession(result.userId, result.organizationId, now) };
  } catch (e) {
    // The same message whether or not the address is taken, so sign-up cannot be used to list accounts.
    if (pgCode(e) === '23505') throw invalid('That email address cannot be used to create an account. If it is yours, sign in instead.');
    throw e;
  }
}

export async function signIn(emailRaw: string, password: string, address: string, now: Date): Promise<{ token: string }> {
  const email = normaliseEmail(emailRaw);
  await rateLimit('login:address', address, LIMITS.loginAttemptsPerAddress, now);
  await rateLimit('login:email', email, LIMITS.loginAttemptsPerEmail, now);
  const [user] = await db().select().from(users).where(eq(users.email, email));
  // A hash is always computed, so a missing account takes as long as a wrong password.
  const ok = user === undefined ? (await hashPassword(password), false) : await verifyPassword(password, user.passwordHash);
  if (user === undefined || !ok) throw new AppError(401, 'bad_credentials', 'The email or password is not right.');
  const [first] = await db().select({ organizationId: memberships.organizationId }).from(memberships).where(eq(memberships.userId, user.id)).orderBy(memberships.createdAt).limit(1);
  return { token: await openSession(user.id, first?.organizationId ?? null, now) };
}

export async function signOut(token: string): Promise<void> {
  await db().delete(sessions).where(eq(sessions.tokenHash, sha256Hex(token)));
}

export async function resolveSession(token: string | null, now: Date): Promise<Session | null> {
  if (token === null || token === '') return null;
  const [row] = await db().select({ sessionId: sessions.id, userId: users.id, email: users.email, name: users.name, activeOrganizationId: sessions.activeOrganizationId })
    .from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256Hex(token)), gt(sessions.expiresAt, now.toISOString())));
  return row ?? null;
}

// The role is read from the database on every request; nothing about it is trusted from the cookie.
export async function roleIn(userId: string, organizationId: string): Promise<Role | null> {
  const [m] = await db().select({ role: memberships.role }).from(memberships).where(and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId)));
  return m?.role ?? null;
}

export async function listOrganizations(userId: string): Promise<{ id: string; name: string; role: Role; isDemo: boolean }[]> {
  return db().select({ id: organizations.id, name: organizations.name, role: memberships.role, isDemo: organizations.isDemo })
    .from(memberships).innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(memberships.userId, userId)).orderBy(organizations.name);
}

export async function switchOrganization(session: Session, organizationId: string): Promise<void> {
  if ((await roleIn(session.userId, organizationId)) === null) throw new AppError(404, 'not_found', 'Not found.');
  await db().update(sessions).set({ activeOrganizationId: organizationId }).where(eq(sessions.id, session.sessionId));
}

export async function findInvitation(token: string, now: Date): Promise<{ id: string; organizationId: string; email: string; role: Role } | null> {
  const [row] = await db().select({ id: invitations.id, organizationId: invitations.organizationId, email: invitations.email, role: invitations.role })
    .from(invitations).where(and(eq(invitations.tokenHash, sha256Hex(token)), isNull(invitations.acceptedAt), gt(invitations.expiresAt, now.toISOString())));
  return row ?? null;
}

// An existing account accepts an invitation issued to its own email address.
export async function acceptInvitation(session: Session, token: string, now: Date): Promise<void> {
  const invite = await findInvitation(token, now);
  if (invite === null || invite.email !== session.email) throw invalid('This invitation is not valid for your account, or has expired.');
  await db().transaction(async tx => {
    await tx.insert(memberships).values({ organizationId: invite.organizationId, userId: session.userId, role: invite.role }).onConflictDoNothing();
    await tx.update(invitations).set({ acceptedAt: now.toISOString() }).where(and(eq(invitations.id, invite.id), eq(invitations.organizationId, invite.organizationId)));
    await tx.update(sessions).set({ activeOrganizationId: invite.organizationId }).where(eq(sessions.id, session.sessionId));
  });
}

// Housekeeping: expired sessions and old attempt rows. Safe to run at any time.
export async function purgeExpired(now: Date): Promise<{ sessions: number; attempts: number }> {
  const gone = await db().delete(sessions).where(lt(sessions.expiresAt, now.toISOString())).returning({ id: sessions.id });
  const old = await db().delete(authAttempts).where(lt(authAttempts.at, new Date(now.getTime() - DAY_MS).toISOString())).returning({ id: authAttempts.id });
  return { sessions: gone.length, attempts: old.length };
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  const secure = env().appUrl.startsWith('https://') ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}
export const SESSION_MAX_AGE = LIMITS.sessionDays * 86_400;
