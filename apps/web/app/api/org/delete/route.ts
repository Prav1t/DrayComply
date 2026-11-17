import { json, memberRoute, readJson, str } from '../../../../server/http';
import { deleteOrganization } from '../../../../server/orgs';

export const POST = memberRoute('POST /api/org/delete', 'owner', async ({ ctx, req }) => {
  await deleteOrganization(ctx, str(await readJson(req), 'confirmName'));
  return json({ ok: true });
});
