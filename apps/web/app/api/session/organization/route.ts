import { switchOrganization } from '../../../../server/auth';
import { AppError } from '../../../../server/errors';
import { isUuid, json, openRoute, readJson } from '../../../../server/http';

export const POST = openRoute('POST /api/session/organization', 'signed_in', async ({ req, session }) => {
  const id = (await readJson(req))['organizationId'];
  if (session === null || !isUuid(id)) throw new AppError(404, 'not_found', 'Not found.');
  await switchOrganization(session, id);
  return json({ ok: true });
});
