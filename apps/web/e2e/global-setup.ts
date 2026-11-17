// Rebuilds the end-to-end database from the migrations before the server starts answering.
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { createDatabase } from '../../../packages/db/src/index';
import { MIGRATIONS_FOLDER } from '../../../packages/db/src/paths';

export default async function globalSetup(): Promise<void> {
  const adminUrl = process.env['TEST_DATABASE_URL'] ?? 'postgresql://dray:dray@localhost:5432/postgres';
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS dray_e2e WITH (FORCE)');
  await admin.query('CREATE DATABASE dray_e2e');
  await admin.end();
  const target = new URL(adminUrl);
  target.pathname = '/dray_e2e';
  const { db, pool } = createDatabase(target.toString(), 1);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  await pool.end();
}
