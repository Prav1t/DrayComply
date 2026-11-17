import { listAudit } from '../../../../server/audit';
import { json, memberRoute } from '../../../../server/http';

export const GET = memberRoute('GET /api/org/audit', 'owner', async ({ ctx }) => json({ entries: await listAudit(ctx) }));
