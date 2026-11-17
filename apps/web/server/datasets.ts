// Data sets: a named group of uploaded files. Originals are stored unchanged with their SHA-256 and never altered.
import { and, asc, desc, eq } from 'drizzle-orm';
import { datasetFiles, datasets, uploads } from '../../../packages/db/src/index';
import type { SourceFile } from '../../../packages/ingest/src/index';
import { audit } from './audit';
import { requireRole, type Ctx } from './context';
import { sha256Hex } from './crypto';
import { db } from './db';
import { invalid, notFound } from './errors';
import { checkFile } from './files';
import { LIMITS } from './limits';

export async function listDatasets(ctx: Ctx) {
  return db().select().from(datasets).where(eq(datasets.organizationId, ctx.organizationId)).orderBy(desc(datasets.createdAt));
}

export async function createDataset(ctx: Ctx, name: string): Promise<{ id: string }> {
  requireRole(ctx, 'payroll');
  return db().transaction(async tx => {
    const [row] = await tx.insert(datasets).values({ organizationId: ctx.organizationId, name, createdBy: ctx.userId }).returning({ id: datasets.id });
    if (row === undefined) throw new Error('dataset insert returned nothing');
    await audit(tx, ctx, 'dataset.created', 'dataset', row.id);
    return row;
  });
}

const FILE_COLUMNS = { uploadId: uploads.id, name: uploads.name, format: uploads.format, sha256: uploads.sha256, sizeBytes: uploads.sizeBytes, createdAt: uploads.createdAt };

export async function getDataset(ctx: Ctx, datasetId: string) {
  const [d] = await db().select().from(datasets).where(and(eq(datasets.organizationId, ctx.organizationId), eq(datasets.id, datasetId)));
  if (d === undefined) throw notFound();
  const files = await db().select(FILE_COLUMNS).from(datasetFiles)
    .innerJoin(uploads, and(eq(uploads.organizationId, datasetFiles.organizationId), eq(uploads.id, datasetFiles.uploadId)))
    .where(and(eq(datasetFiles.organizationId, ctx.organizationId), eq(datasetFiles.datasetId, datasetId))).orderBy(asc(uploads.name));
  return { ...d, files };
}

// Stores each file as a new immutable upload and points the data set at it. A file with the same name is superseded, not overwritten.
export async function addFiles(ctx: Ctx, datasetId: string, incoming: readonly { readonly name: string; readonly bytes: Uint8Array }[]): Promise<{ stored: { name: string; sha256: string; replaced: boolean }[] }> {
  requireRole(ctx, 'payroll');
  if (incoming.length === 0) throw invalid('Choose at least one file.');
  const checked = incoming.map(f => checkFile(f.name, f.bytes));
  const names = checked.map(f => f.name);
  if (new Set(names).size !== names.length) throw invalid('Two of the files have the same name.');
  return db().transaction(async tx => {
    const current = await tx.select({ name: datasetFiles.name }).from(datasetFiles).where(and(eq(datasetFiles.organizationId, ctx.organizationId), eq(datasetFiles.datasetId, datasetId)));
    const [d] = await tx.select({ id: datasets.id }).from(datasets).where(and(eq(datasets.organizationId, ctx.organizationId), eq(datasets.id, datasetId)));
    if (d === undefined) throw notFound();
    const total = new Set([...current.map(c => c.name), ...names]).size;
    if (total > LIMITS.maxFilesPerDataset) throw invalid(`A data set holds at most ${LIMITS.maxFilesPerDataset} files.`);
    const stored: { name: string; sha256: string; replaced: boolean }[] = [];
    for (const f of checked) {
      const sha256 = sha256Hex(f.bytes);
      const [row] = await tx.insert(uploads).values({ organizationId: ctx.organizationId, kind: 'source', name: f.name, format: f.format, sha256, sizeBytes: f.bytes.length, content: Buffer.from(f.bytes), uploadedBy: ctx.userId }).returning({ id: uploads.id });
      if (row === undefined) throw new Error('upload insert returned nothing');
      const replaced = current.some(c => c.name === f.name);
      await tx.insert(datasetFiles).values({ organizationId: ctx.organizationId, datasetId, name: f.name, uploadId: row.id })
        .onConflictDoUpdate({ target: [datasetFiles.datasetId, datasetFiles.name], set: { uploadId: row.id } });
      await audit(tx, ctx, replaced ? 'upload.replaced' : 'upload.stored', 'upload', row.id, { sha256, bytes: f.bytes.length, datasetId });
      stored.push({ name: f.name, sha256, replaced });
    }
    return { stored };
  });
}

// Takes a file out of the data set. The stored original stays, because earlier runs may have read it.
export async function removeFile(ctx: Ctx, datasetId: string, name: string): Promise<void> {
  requireRole(ctx, 'payroll');
  await db().transaction(async tx => {
    const gone = await tx.delete(datasetFiles).where(and(eq(datasetFiles.organizationId, ctx.organizationId), eq(datasetFiles.datasetId, datasetId), eq(datasetFiles.name, name))).returning({ uploadId: datasetFiles.uploadId });
    const first = gone[0];
    if (first === undefined) throw notFound();
    await audit(tx, ctx, 'upload.removed_from_dataset', 'upload', first.uploadId, { datasetId });
  });
}

export interface StoredFile extends SourceFile { readonly uploadId: string; readonly sha256: string }

// The current files of a data set, with their bytes, verified against the stored hash.
export async function loadDatasetFiles(ctx: Ctx, datasetId: string): Promise<StoredFile[]> {
  const rows = await db().select({ ...FILE_COLUMNS, content: uploads.content }).from(datasetFiles)
    .innerJoin(uploads, and(eq(uploads.organizationId, datasetFiles.organizationId), eq(uploads.id, datasetFiles.uploadId)))
    .where(and(eq(datasetFiles.organizationId, ctx.organizationId), eq(datasetFiles.datasetId, datasetId))).orderBy(asc(uploads.name));
  return rows.map(r => {
    const bytes = new Uint8Array(r.content);
    if (sha256Hex(bytes) !== r.sha256) throw new Error('stored file does not match its recorded hash');
    return { uploadId: r.uploadId, name: r.name, format: r.format, bytes, sha256: r.sha256 };
  });
}

export async function getUploadContent(ctx: Ctx, uploadId: string): Promise<{ name: string; format: 'csv' | 'xlsx'; sha256: string; bytes: Uint8Array }> {
  const [row] = await db().select({ name: uploads.name, format: uploads.format, sha256: uploads.sha256, content: uploads.content }).from(uploads)
    .where(and(eq(uploads.organizationId, ctx.organizationId), eq(uploads.id, uploadId)));
  if (row === undefined) throw notFound();
  return { name: row.name, format: row.format, sha256: row.sha256, bytes: new Uint8Array(row.content) };
}
