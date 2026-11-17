// Creates the demonstration organization. Usage: DATABASE_URL=... APP_URL=... DEMO_EMAIL=... DEMO_PASSWORD=... npm run db:seed-demo
import { database } from '../server/db';
import { seedDemo } from '../server/demo';

const email = process.env['DEMO_EMAIL'] ?? '';
const password = process.env['DEMO_PASSWORD'] ?? '';
if (email === '' || password.length < 12) {
  console.error('Set DEMO_EMAIL and DEMO_PASSWORD (12 characters or more). No default password exists.');
  process.exit(1);
}
const result = await seedDemo(email, password, new Date());
console.log(result.kind === 'exists' ? 'An account with that email already exists. Nothing was changed.' : `Demo organization created. Sign in as ${email}.`);
await database().pool.end();
