import { getDataset } from '../../../../server/datasets';
import { json, memberRoute, uuidParam } from '../../../../server/http';

export const GET = memberRoute('GET /api/datasets/[id]', 'viewer', async ({ ctx, params }) => json({ dataset: await getDataset(ctx, uuidParam(params, 'id')) }));
