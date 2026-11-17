import { invalid } from '../../../server/errors';
import { json, memberRoute, readJson } from '../../../server/http';
import { listTemplates, saveTemplate } from '../../../server/templates';

const purposeOf = (v: unknown): 'records' | 'drivers' => {
  if (v === 'records' || v === 'drivers') return v;
  throw invalid('"purpose" must be records or drivers.');
};

export const GET = memberRoute('GET /api/templates', 'viewer', async ({ ctx, req }) =>
  json({ templates: await listTemplates(ctx, purposeOf(new URL(req.url).searchParams.get('purpose') ?? 'records')) }));
export const POST = memberRoute('POST /api/templates', 'payroll', async ({ ctx, req }) => {
  const body = await readJson(req);
  return json(await saveTemplate(ctx, body['template'], purposeOf(body['purpose'])), 201);
});
