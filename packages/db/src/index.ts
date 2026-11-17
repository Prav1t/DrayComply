import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export * from './schema';
export { schema };
export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Conn = Db | Tx;

export interface Database { readonly db: Db; readonly pool: pg.Pool }

// date and timestamp columns are read as text, never as Date, so no time zone shifts a pay period.
// caCert is the provider's CA certificate. With it the server certificate is verified against that CA; verification is never turned off.
export function createDatabase(url: string, max = 10, caCert: string | null = null): Database {
  let connectionString = url;
  if (caCert !== null) {
    const u = new URL(url);
    u.searchParams.delete('sslmode');   // the ssl option below decides, not the URL
    connectionString = u.toString();
  }
  const pool = new pg.Pool({ connectionString, max, ...(caCert === null ? {} : { ssl: { ca: caCert, rejectUnauthorized: true } }) });
  return { db: drizzle(pool, { schema }), pool };
}

