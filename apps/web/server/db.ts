import { createDatabase, type Database, type Db } from '../../../packages/db/src/index';
import { env } from './env';

declare global {
  // One pool per server process. Next reloads modules in development, so the pool is kept on globalThis.
  var draycomplyDatabase: Database | undefined;
}

export function database(): Database {
  globalThis.draycomplyDatabase ??= createDatabase(env().databaseUrl);
  return globalThis.draycomplyDatabase;
}
export const db = (): Db => database().db;

export function setDatabaseForTests(d: Database | null): void {
  globalThis.draycomplyDatabase = d ?? undefined;
}
