import { desc, eq } from 'drizzle-orm';
import { auditLog, type Conn } from '../../../packages/db/src/index';
import { db } from './db';
import type { Ctx } from './context';

// detail carries identifiers, counts and hashes only. Never a name, an amount or a row of payroll data.
export type AuditDetail = Readonly<Record<string, string | number | boolean | null | readonly string[]>>;

export async function audit(conn: Conn, ctx: Ctx, action: string, entity: string, entityId: string | null, detail: AuditDetail = {}): Promise<void> {
  await conn.insert(auditLog).values({ organizationId: ctx.organizationId, userId: ctx.userId, action, entity, entityId, detail, at: ctx.now.toISOString() });
}

export async function listAudit(ctx: Ctx, limit = 200) {
  return db().select().from(auditLog).where(eq(auditLog.organizationId, ctx.organizationId)).orderBy(desc(auditLog.id)).limit(limit);
}
