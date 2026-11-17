import { SESSION_MAX_AGE, sessionCookie, signUp } from '../../../../server/auth';
import { clientAddress, json, openRoute, optionalStr, readJson, str } from '../../../../server/http';
import { LIMITS } from '../../../../server/limits';

export const POST = openRoute('POST /api/auth/signup', 'public', async ({ req, now }) => {
  const body = await readJson(req);
  const { token } = await signUp({
    email: str(body, 'email'), name: str(body, 'name'), password: str(body, 'password', LIMITS.passwordMaxLength),
    organizationName: optionalStr(body, 'organizationName'), invitationToken: optionalStr(body, 'invite'),
  }, clientAddress(req), now);
  return json({ ok: true }, 201, { 'set-cookie': sessionCookie(token, SESSION_MAX_AGE) });
});
