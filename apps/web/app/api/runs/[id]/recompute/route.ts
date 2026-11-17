import { recompute } from '../../../../../server/assess';
import { json, memberRoute, uuidParam } from '../../../../../server/http';

export const POST = memberRoute('POST /api/runs/[id]/recompute', 'viewer', async ({ ctx, params }) => json(await recompute(ctx, uuidParam(params, 'id'))));
