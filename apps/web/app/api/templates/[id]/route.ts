import { json, memberRoute, uuidParam } from '../../../../server/http';
import { getTemplate } from '../../../../server/templates';

export const GET = memberRoute('GET /api/templates/[id]', 'viewer', async ({ ctx, params }) => json(await getTemplate(ctx, uuidParam(params, 'id'))));
