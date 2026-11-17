import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Used only by the migrate script and the tests, never by the web bundle.
export const MIGRATIONS_FOLDER = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
