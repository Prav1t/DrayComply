import { defineConfig } from 'drizzle-kit';

// Used only to generate migration SQL from the schema. It never connects to a database.
export default defineConfig({ dialect: 'postgresql', schema: './packages/db/src/schema.ts', out: './packages/db/migrations' });
