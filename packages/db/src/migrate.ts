// Applies every pending migration to DATABASE_URL. Run on each release, before the app starts.
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase, MIGRATIONS_FOLDER } from './index';

const url = process.env['DATABASE_URL'];
if (url === undefined || url === '') {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
const { db, pool } = createDatabase(url, 1);
await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
await pool.end();
console.log('migrations applied');
