import { json, memberRoute, readJson, str, uuidParam } from '../../../../../server/http';
import { removeMember, setRole } from '../../../../../server/orgs';

export const PATCH = memberRoute('PATCH /api/org/members/[userId]', 'owner', async ({ ctx, params, req }) => {
  await setRole(ctx, uuidParam(params, 'userId'), str(await readJson(req), 'role'));
  return json({ ok: true });
});
export const DELETE = memberRoute('DELETE /api/org/members/[userId]', 'owner', async ({ ctx, params }) => {
  await removeMember(ctx, uuidParam(params, 'userId'));
  return json({ ok: true });
});
