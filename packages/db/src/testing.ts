// A fresh, migrated database per test file, on the Postgres at TEST_DATABASE_URL.
import { randomBytes } from 'node:crypto';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { createDatabase, type Database } from './index';
import { MIGRATIONS_FOLDER } from './paths';

export const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'] ?? 'postgresql://dray:dray@localhost:5432/postgres';

export interface TestDatabase extends Database { readonly url: string; readonly drop: () => Promise<void> }

export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `dray_test_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const target = new URL(TEST_DATABASE_URL);
  target.pathname = `/${name}`;
  const database = createDatabase(target.toString(), 5);
  await migrate(database.db, { migrationsFolder: MIGRATIONS_FOLDER });
  return {
    ...database, url: target.toString(),
    drop: async () => {
      await database.pool.end();
      const again = new pg.Client({ connectionString: TEST_DATABASE_URL });
      await again.connect();
      await again.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await again.end();
    },
  };
}
