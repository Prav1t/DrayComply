import { json, memberRoute, readJson, str } from '../../../../server/http';
import { invite, listInvitations } from '../../../../server/orgs';

export const GET = memberRoute('GET /api/org/invitations', 'owner', async ({ ctx }) => json({ invitations: await listInvitations(ctx) }));
export const POST = memberRoute('POST /api/org/invitations', 'owner', async ({ ctx, req }) => {
  const body = await readJson(req);
  return json(await invite(ctx, str(body, 'email'), str(body, 'role')), 201);
});
