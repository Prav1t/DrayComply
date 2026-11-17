// Mapping templates. Each save is a new immutable version, so a run always points at the exact mapping it used.
import { and, desc, eq, sql } from 'drizzle-orm';
import { mappingTemplates } from '../../../packages/db/src/index';
import { parseTemplate, serializeTemplate, type MappingTemplate } from '../../../packages/ingest/src/index';
import { audit } from './audit';
import { requireRole, type Ctx } from './context';
import { sha256Hex } from './crypto';
import { db } from './db';
import { invalid, notFound } from './errors';

export type TemplatePurpose = 'records' | 'drivers';

const SUMMARY = { id: mappingTemplates.id, templateKey: mappingTemplates.templateKey, name: mappingTemplates.name, version: mappingTemplates.version, purpose: mappingTemplates.purpose, sha256: mappingTemplates.sha256, createdAt: mappingTemplates.createdAt };

export async function listTemplates(ctx: Ctx, purpose: TemplatePurpose) {
  const rows = await db().select(SUMMARY).from(mappingTemplates)
    .where(and(eq(mappingTemplates.organizationId, ctx.organizationId), eq(mappingTemplates.purpose, purpose))).orderBy(desc(mappingTemplates.createdAt), desc(mappingTemplates.version));
  // The newest version of each template comes first; older versions stay readable by id.
  return rows.filter((r, i) => rows.findIndex(x => x.templateKey === r.templateKey) === i);
}

export async function getTemplate(ctx: Ctx, templateId: string): Promise<{ id: string; name: string; version: number; purpose: TemplatePurpose; sha256: string; template: MappingTemplate }> {
  const [row] = await db().select().from(mappingTemplates).where(and(eq(mappingTemplates.organizationId, ctx.organizationId), eq(mappingTemplates.id, templateId)));
  if (row === undefined) throw notFound();
  const parsed = parseTemplate(row.body);
  if (parsed.kind !== 'ok') throw new Error('stored template no longer parses');
  return { id: row.id, name: row.name, version: row.version, purpose: row.purpose, sha256: row.sha256, template: parsed.template };
}

// In a records template the driver tables are declared "none": drivers always come from the roster kept in the app.
export async function saveTemplate(ctx: Ctx, body: unknown, purpose: TemplatePurpose): Promise<{ id: string; version: number }> {
  requireRole(ctx, 'payroll');
  const parsed = parseTemplate(body);
  if (parsed.kind === 'invalid') throw invalid('The template is not complete.', parsed.errors);
  const t = parsed.template;
  if (purpose === 'records' && (t.tables.drivers.kind !== 'none' || t.tables.otherLicenseeHours.kind !== 'none')) {
    throw invalid('In a records template, drivers and hours for other licensees are not mapped: they come from the Drivers page.');
  }
  if (purpose === 'drivers' && t.tables.drivers.kind !== 'mapped') throw invalid('A driver import template must map the drivers table.');
  return db().transaction(async tx => {
    const [last] = await tx.select({ version: sql<number>`coalesce(max(${mappingTemplates.version}), 0)::int` }).from(mappingTemplates)
      .where(and(eq(mappingTemplates.organizationId, ctx.organizationId), eq(mappingTemplates.templateKey, t.id)));
    const version = (last?.version ?? 0) + 1;
    const stored: MappingTemplate = { ...t, version };
    const text = serializeTemplate(stored);
    const [row] = await tx.insert(mappingTemplates).values({ organizationId: ctx.organizationId, templateKey: t.id, name: t.name, version, purpose, body: JSON.parse(text), sha256: sha256Hex(text), createdBy: ctx.userId }).returning({ id: mappingTemplates.id });
    if (row === undefined) throw new Error('template insert returned nothing');
    await audit(tx, ctx, 'template.saved', 'template', row.id, { version });
    return { id: row.id, version };
  });
}
