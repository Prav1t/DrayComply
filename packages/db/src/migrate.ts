// Applies every pending migration to DATABASE_URL. Run on each release, before the app starts.
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from './index';
import { MIGRATIONS_FOLDER } from './paths';

const url = process.env['DATABASE_URL'];
if (url === undefined || url === '') {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
const ca = process.env['DATABASE_CA_CERT'];
const { db, pool } = createDatabase(url, 1, ca === undefined || ca.trim() === '' ? null : ca);
await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
await pool.end();
console.log('migrations applied');
