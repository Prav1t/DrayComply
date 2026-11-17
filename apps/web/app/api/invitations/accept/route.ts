import { acceptInvitation } from '../../../../server/auth';
import { AppError } from '../../../../server/errors';
import { json, openRoute, readJson, str } from '../../../../server/http';

export const POST = openRoute('POST /api/invitations/accept', 'signed_in', async ({ req, session, now }) => {
  if (session === null) throw new AppError(401, 'signed_out', 'Sign in to continue.');
  await acceptInvitation(session, str(await readJson(req), 'token'), now);
  return json({ ok: true });
});
