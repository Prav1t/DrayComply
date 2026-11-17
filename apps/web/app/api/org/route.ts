import { json, memberRoute } from '../../../server/http';
import { getOrganization, listMembers } from '../../../server/orgs';

export const GET = memberRoute('GET /api/org', 'viewer', async ({ ctx }) => json({ organization: await getOrganization(ctx), members: await listMembers(ctx) }));
