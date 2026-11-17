import { checkDataset } from '../../../../../server/assess';
import { notFound } from '../../../../../server/errors';
import { isUuid, json, memberRoute, readJson, uuidParam } from '../../../../../server/http';

export const POST = memberRoute('POST /api/datasets/[id]/check', 'viewer', async ({ ctx, params, req }) => {
  const templateId = (await readJson(req))['templateId'];
  if (!isUuid(templateId)) throw notFound();
  return json(await checkDataset(ctx, uuidParam(params, 'id'), templateId));
});
