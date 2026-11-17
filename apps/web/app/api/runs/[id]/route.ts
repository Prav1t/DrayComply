import { getRun } from '../../../../server/assess';
import { json, memberRoute, uuidParam } from '../../../../server/http';

export const GET = memberRoute('GET /api/runs/[id]', 'viewer', async ({ ctx, params }) => json({ run: await getRun(ctx, uuidParam(params, 'id')) }));
