import { SESSION_MAX_AGE, sessionCookie, signIn } from '../../../../server/auth';
import { clientAddress, json, openRoute, readJson, str } from '../../../../server/http';
import { LIMITS } from '../../../../server/limits';

export const POST = openRoute('POST /api/auth/login', 'public', async ({ req, now }) => {
  const body = await readJson(req);
  const { token } = await signIn(str(body, 'email'), str(body, 'password', LIMITS.passwordMaxLength), clientAddress(req), now);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token, SESSION_MAX_AGE) });
});
