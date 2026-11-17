import { addFiles, removeFile } from '../../../../../server/datasets';
import { notFound } from '../../../../../server/errors';
import { json, memberRoute, readMultipart, uuidParam } from '../../../../../server/http';

export const POST = memberRoute('POST /api/datasets/[id]/files', 'payroll', async ({ ctx, params, req }) =>
  json(await addFiles(ctx, uuidParam(params, 'id'), (await readMultipart(req)).files), 201));

export const DELETE = memberRoute('DELETE /api/datasets/[id]/files', 'payroll', async ({ ctx, params, req }) => {
  const name = new URL(req.url).searchParams.get('name');
  if (name === null) throw notFound();
  await removeFile(ctx, uuidParam(params, 'id'), name);
  return json({ ok: true });
});
