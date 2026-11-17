// Audit binder PDFs. Built by packages/report from a stored run, stored once, never changed.
import { and, desc, eq } from 'drizzle-orm';
import { organizations, reports } from '../../../packages/db/src/index';
import { renderPdf } from '../../../packages/report/src/index';
import { binderFor, getRun } from './assess';
import { audit } from './audit';
import { requireRole, type Ctx } from './context';
import { sha256Hex } from './crypto';
import { db } from './db';
import { invalid, notFound } from './errors';

const SUMMARY = { id: reports.id, runId: reports.runId, generatedAt: reports.generatedAt, sha256: reports.sha256, sizeBytes: reports.sizeBytes, watermarked: reports.watermarked, pendingLegalReview: reports.pendingLegalReview };

export async function organizationName(ctx: Ctx): Promise<string> {
  const [org] = await db().select({ name: organizations.name }).from(organizations).where(eq(organizations.id, ctx.organizationId));
  if (org === undefined) throw notFound();
  return org.name;
}

export async function generateReport(ctx: Ctx, runId: string): Promise<{ id: string; sha256: string; watermarked: boolean }> {
  requireRole(ctx, 'payroll');
  const run = await getRun(ctx, runId);
  const generatedAt = ctx.now.toISOString();
  const binder = binderFor(run, await organizationName(ctx), generatedAt);
  if (binder === null) throw invalid('This run stopped before the calculation, so there is no report to generate.');
  const pdf = await renderPdf(binder);
  const sha256 = sha256Hex(pdf);
  const watermarked = binder.header.watermark !== null;
  return db().transaction(async tx => {
    const [row] = await tx.insert(reports).values({
      organizationId: ctx.organizationId, runId, createdBy: ctx.userId, generatedAt, sha256, sizeBytes: pdf.length,
      watermarked, pendingLegalReview: binder.pendingLegalReview.length > 0, content: Buffer.from(pdf),
    }).returning({ id: reports.id });
    if (row === undefined) throw new Error('report insert returned nothing');
    await audit(tx, ctx, 'report.generated', 'report', row.id, { runId, sha256, watermarked });
    return { id: row.id, sha256, watermarked };
  });
}

export async function listReports(ctx: Ctx, runId: string) {
  return db().select(SUMMARY).from(reports).where(and(eq(reports.organizationId, ctx.organizationId), eq(reports.runId, runId))).orderBy(desc(reports.generatedAt));
}

export async function getReportContent(ctx: Ctx, reportId: string): Promise<{ bytes: Uint8Array; sha256: string; generatedAt: string }> {
  const [row] = await db().select({ content: reports.content, sha256: reports.sha256, generatedAt: reports.generatedAt }).from(reports)
    .where(and(eq(reports.organizationId, ctx.organizationId), eq(reports.id, reportId)));
  if (row === undefined) throw notFound();
  const bytes = new Uint8Array(row.content);
  if (sha256Hex(bytes) !== row.sha256) throw new Error('stored report does not match its recorded hash');
  await audit(db(), ctx, 'report.downloaded', 'report', reportId);
  return { bytes, sha256: row.sha256, generatedAt: row.generatedAt };
}
