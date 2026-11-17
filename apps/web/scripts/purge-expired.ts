// Removes expired sessions and old sign-in attempt rows. Safe to run daily. Usage: DATABASE_URL=... APP_URL=... npm run db:purge-expired
import { purgeExpired } from '../server/auth';
import { database } from '../server/db';

const removed = await purgeExpired(new Date());
console.log(`removed ${removed.sessions} expired session(s) and ${removed.attempts} old attempt row(s)`);
await database().pool.end();
