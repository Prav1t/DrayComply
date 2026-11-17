// Creates an organization and a one-time owner invitation link, for when sign-up is closed.
// Usage: DATABASE_URL=... APP_URL=... npm run org:create -- "Company name" owner@example.com
import { invitations, organizations, users } from '../../../packages/db/src/index';
import { newToken, sha256Hex } from '../server/crypto';
import { database, db } from '../server/db';
import { env } from '../server/env';
import { LIMITS } from '../server/limits';

const [name, emailRaw] = process.argv.slice(2);
const email = (emailRaw ?? '').trim().toLowerCase();
if (name === undefined || name.trim() === '' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run org:create -- "Company name" owner@example.com');
  process.exit(1);
}
const token = newToken();
const expiresAt = new Date(Date.now() + LIMITS.invitationDays * 86_400_000).toISOString();
await db().transaction(async tx => {
  // The invitation needs a creator: a system account that cannot sign in, because its password hash matches nothing.
  const [system] = await tx.insert(users).values({ email: 'system@draycomply.invalid', name: 'System', passwordHash: 'disabled' })
    .onConflictDoUpdate({ target: users.email, set: { name: 'System' } }).returning({ id: users.id });
  const [org] = await tx.insert(organizations).values({ name: name.trim() }).returning({ id: organizations.id });
  if (system === undefined || org === undefined) throw new Error('insert returned nothing');
  await tx.insert(invitations).values({ organizationId: org.id, email, role: 'owner', tokenHash: sha256Hex(token), createdBy: system.id, expiresAt });
});
console.log(`Organization created. Send this link to ${email} (valid ${LIMITS.invitationDays} days, shown once):`);
console.log(`${env().appUrl}/signup?invite=${token}`);
await database().pool.end();
