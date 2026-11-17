// Organization settings: members, invitations, data export and deletion.
import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';
import { strToU8, zipSync } from 'fflate';
import {
  auditLog, datasetFiles, datasets, deletionReceipts, driverClassPeriods, driverOtherHours, drivers, invitations, mappingTemplates, memberships, organizations,
  reports, runResults, runs, uploads, users, ROLES, type Role,
} from '../../../packages/db/src/index';
import { audit } from './audit';
import { normaliseEmail } from './auth';
import { requireRole, type Ctx } from './context';
import { newToken, sha256Hex } from './crypto';
import { db } from './db';
import { env } from './env';
import { invalid, notFound } from './errors';
import { LIMITS } from './limits';

export async function getOrganization(ctx: Ctx) {
  const [org] = await db().select().from(organizations).where(eq(organizations.id, ctx.organizationId));
  if (org === undefined) throw notFound();
  return org;
}

export async function listMembers(ctx: Ctx) {
  return db().select({ userId: users.id, email: users.email, name: users.name, role: memberships.role }).from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.organizationId, ctx.organizationId)).orderBy(asc(users.email));
}

export async function listInvitations(ctx: Ctx) {
  requireRole(ctx, 'owner');
  return db().select({ id: invitations.id, email: invitations.email, role: invitations.role, expiresAt: invitations.expiresAt }).from(invitations)
    .where(and(eq(invitations.organizationId, ctx.organizationId), isNull(invitations.acceptedAt), gt(invitations.expiresAt, ctx.now.toISOString())));
}

const asRole = (v: string): Role => {
  const role = ROLES.find(r => r === v);
  if (role === undefined) throw invalid('Choose a role: owner, payroll or viewer.');
  return role;
};

// The link is returned once, for the owner to send themselves. Only its hash is stored. No email is sent by the app.
export async function invite(ctx: Ctx, emailRaw: string, roleRaw: string): Promise<{ link: string; expiresAt: string }> {
  requireRole(ctx, 'owner');
  const email = normaliseEmail(emailRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid('Enter a valid email address.');
  const role = asRole(roleRaw);
  const token = newToken();
  const expiresAt = new Date(ctx.now.getTime() + LIMITS.invitationDays * 86_400_000).toISOString();
  await db().transaction(async tx => {
    const [row] = await tx.insert(invitations).values({ organizationId: ctx.organizationId, email, role, tokenHash: sha256Hex(token), createdBy: ctx.userId, expiresAt }).returning({ id: invitations.id });
    await audit(tx, ctx, 'member.invited', 'invitation', row?.id ?? null, { role });
  });
  return { link: `${env().appUrl}/signup?invite=${token}`, expiresAt };
}

async function ownerCount(ctx: Ctx): Promise<number> {
  const [row] = await db().select({ n: sql<number>`count(*)::int` }).from(memberships).where(and(eq(memberships.organizationId, ctx.organizationId), eq(memberships.role, 'owner')));
  return row?.n ?? 0;
}

export async function setRole(ctx: Ctx, userId: string, roleRaw: string): Promise<void> {
  requireRole(ctx, 'owner');
  const role = asRole(roleRaw);
  const [m] = await db().select({ role: memberships.role }).from(memberships).where(and(eq(memberships.organizationId, ctx.organizationId), eq(memberships.userId, userId)));
  if (m === undefined) throw notFound();
  if (m.role === 'owner' && role !== 'owner' && (await ownerCount(ctx)) <= 1) throw invalid('An organization must keep at least one owner.');
  await db().transaction(async tx => {
    await tx.update(memberships).set({ role }).where(and(eq(memberships.organizationId, ctx.organizationId), eq(memberships.userId, userId)));
    await audit(tx, ctx, 'member.role_changed', 'user', userId, { role });
  });
}

export async function removeMember(ctx: Ctx, userId: string): Promise<void> {
  requireRole(ctx, 'owner');
  const [m] = await db().select({ role: memberships.role }).from(memberships).where(and(eq(memberships.organizationId, ctx.organizationId), eq(memberships.userId, userId)));
  if (m === undefined) throw notFound();
  if (m.role === 'owner' && (await ownerCount(ctx)) <= 1) throw invalid('An organization must keep at least one owner.');
  await db().transaction(async tx => {
    await tx.delete(memberships).where(and(eq(memberships.organizationId, ctx.organizationId), eq(memberships.userId, userId)));
    await audit(tx, ctx, 'member.removed', 'user', userId);
  });
}

const hex = (b: Buffer): string => b.toString('hex').slice(0, 12);

// Everything the organization has stored, as one zip: the original files, the reports, and every row as JSON.
export async function exportOrganization(ctx: Ctx): Promise<Uint8Array> {
  requireRole(ctx, 'owner');
  const o = ctx.organizationId;
  const files = await db().select().from(uploads).where(eq(uploads.organizationId, o));
  const pdfs = await db().select().from(reports).where(eq(reports.organizationId, o));
  const data = {
    exportedAt: ctx.now.toISOString(),
    organization: await getOrganization(ctx),
    members: await listMembers(ctx),
    drivers: await db().select().from(drivers).where(eq(drivers.organizationId, o)),
    driverClassPeriods: await db().select().from(driverClassPeriods).where(eq(driverClassPeriods.organizationId, o)),
    driverOtherHours: await db().select().from(driverOtherHours).where(eq(driverOtherHours.organizationId, o)),
    datasets: await db().select().from(datasets).where(eq(datasets.organizationId, o)),
    datasetFiles: await db().select().from(datasetFiles).where(eq(datasetFiles.organizationId, o)),
    uploads: files.map(({ content, ...rest }) => ({ ...rest, file: `files/${rest.id}-${rest.name}`, check: hex(content) })),
    mappingTemplates: await db().select().from(mappingTemplates).where(eq(mappingTemplates.organizationId, o)),
    runs: await db().select().from(runs).where(eq(runs.organizationId, o)),
    runResults: await db().select().from(runResults).where(eq(runResults.organizationId, o)),
    reports: pdfs.map(({ content, ...rest }) => ({ ...rest, file: `reports/${rest.id}.pdf`, check: hex(content) })),
    auditLog: await db().select().from(auditLog).where(eq(auditLog.organizationId, o)).orderBy(asc(auditLog.id)),
  };
  const entries: Record<string, Uint8Array> = { 'data.json': strToU8(JSON.stringify(data, null, 2)) };
  files.forEach(f => { entries[`files/${f.id}-${f.name}`] = new Uint8Array(f.content); });
  pdfs.forEach(r => { entries[`reports/${r.id}.pdf`] = new Uint8Array(r.content); });
  await audit(db(), ctx, 'organization.exported', 'organization', o, { count: files.length + pdfs.length });
  return zipSync(entries);
}

// Deletes every row the organization owns, in one transaction. What remains is a receipt with row counts and no customer data.
export async function deleteOrganization(ctx: Ctx, confirmName: string): Promise<void> {
  requireRole(ctx, 'owner');
  const org = await getOrganization(ctx);
  if (confirmName !== org.name) throw invalid('Type the organization name exactly to confirm.');
  await db().transaction(async tx => {
    const count = async (table: typeof drivers | typeof uploads | typeof runs | typeof reports | typeof auditLog): Promise<number> => {
      const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(table).where(eq(table.organizationId, ctx.organizationId));
      return row?.n ?? 0;
    };
    const rowCounts = { drivers: await count(drivers), uploads: await count(uploads), runs: await count(runs), reports: await count(reports), auditLog: await count(auditLog) };
    await tx.insert(deletionReceipts).values({ organizationId: ctx.organizationId, deletedByUserId: ctx.userId, rowCounts, deletedAt: ctx.now.toISOString() });
    // Lifts the append-only rule for this transaction only, so the cascade can remove runs, reports and the audit log.
    await tx.execute(sql`set local draycomply.purge = 'on'`);
    await tx.delete(organizations).where(eq(organizations.id, ctx.organizationId));
  });
}
