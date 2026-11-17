import { createDataset, listDatasets } from '../../../server/datasets';
import { json, memberRoute, readJson, str } from '../../../server/http';

export const GET = memberRoute('GET /api/datasets', 'viewer', async ({ ctx }) => json({ datasets: await listDatasets(ctx) }));
export const POST = memberRoute('POST /api/datasets', 'payroll', async ({ ctx, req }) => json(await createDataset(ctx, str(await readJson(req), 'name')), 201));
