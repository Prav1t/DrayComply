import Link from 'next/link';
import { ApiForm } from '../../components/ApiForm';

export default function Login() {
  return (
    <main>
      <header className="masthead"><h1>Sign in</h1></header>
      <section className="card">
        <ApiForm action="/api/auth/login" submit="Sign in" then="/app">
          <label>Email<input type="email" name="email" autoComplete="username" required /></label>
          <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
        </ApiForm>
        <p className="muted">No account? <Link href="/signup">Create one</Link>. Forgotten password: contact support; there is no automatic reset yet.</p>
      </section>
    </main>
  );
}
