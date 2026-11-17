import { sessionCookie, signOut } from '../../../../server/auth';
import { cookieToken, json, openRoute } from '../../../../server/http';

export const POST = openRoute('POST /api/auth/logout', 'public', async ({ req }) => {
  const token = cookieToken(req);
  if (token !== null) await signOut(token);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
});
