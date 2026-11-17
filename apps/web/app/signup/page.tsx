import Link from 'next/link';
import { ApiForm } from '../../components/ApiForm';
import { findInvitation } from '../../server/auth';
import { env } from '../../server/env';

export const dynamic = 'force-dynamic';

export default async function SignUp({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const token = (await searchParams).invite ?? '';
  const invite = token === '' ? null : await findInvitation(token, new Date());
  const closed = invite === null && !env().signupOpen;
  return (
    <main>
      <header className="masthead"><h1>Create an account</h1></header>
      <section className="card">
        {token !== '' && invite === null && <div className="banner bad">This invitation is not valid or has expired. Ask the owner for a new one.</div>}
        {closed ? <div className="banner note">New accounts are by invitation only. Ask your organization&apos;s owner for an invitation link.</div> : (
          <ApiForm action="/api/auth/signup" submit="Create account" then="/app">
            {invite !== null && <input type="hidden" name="invite" value={token} />}
            <label>Your name<input type="text" name="name" autoComplete="name" required /></label>
            <label>Email<input type="email" name="email" autoComplete="username" required defaultValue={invite?.email ?? ''} readOnly={invite !== null} /></label>
            <label>Password (12 characters or more)<input type="password" name="password" autoComplete="new-password" minLength={12} required /></label>
            {invite === null && <label>Company name<input type="text" name="organizationName" autoComplete="organization" required /></label>}
          </ApiForm>
        )}
        {invite !== null && <p className="muted">You are joining an existing organization as {invite.role}.</p>}
        <p className="muted">Already have an account? <Link href="/login">Sign in</Link>. By creating an account you accept the <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>.</p>
      </section>
    </main>
  );
}
