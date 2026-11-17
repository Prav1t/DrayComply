import type { Role } from '../../../packages/db/src/index';
import { resolveSession, roleIn, type Session } from './auth';
import { forbidden, AppError } from './errors';

// Who is asking, and for which organization. Every data function takes one and scopes every query by it.
export interface Ctx {
  readonly organizationId: string;
  readonly userId: string;
  readonly role: Role;
  readonly now: Date;        // the clock is read once per request, here
}

const RANK: Readonly<Record<Role, number>> = { viewer: 1, payroll: 2, owner: 3 };
export const atLeast = (role: Role, needed: Role): boolean => RANK[role] >= RANK[needed];

export function requireRole(ctx: Ctx, needed: Role): void {
  if (!atLeast(ctx.role, needed)) throw forbidden();
}

export async function contextFor(session: Session | null, now: Date): Promise<Ctx> {
  if (session === null) throw new AppError(401, 'signed_out', 'Sign in to continue.');
  if (session.activeOrganizationId === null) throw new AppError(409, 'no_organization', 'Your account does not belong to an organization.');
  const role = await roleIn(session.userId, session.activeOrganizationId);
  if (role === null) throw new AppError(409, 'no_organization', 'Your account does not belong to this organization.');
  return { organizationId: session.activeOrganizationId, userId: session.userId, role, now };
}

export const sessionFromToken = (token: string | null, now: Date): Promise<Session | null> => resolveSession(token, now);
