import { sql } from 'drizzle-orm';
import { db } from '../../../server/db';
import { json, openRoute } from '../../../server/http';

export const dynamic = 'force-dynamic';

// Up only when the database answers. Says nothing else about the system.
export const GET = openRoute('GET /api/health', 'public', async () => {
  try {
    await db().execute(sql`select 1`);
    return json({ status: 'ok' });
  } catch {
    return json({ status: 'database_unreachable' }, 503);
  }
});
