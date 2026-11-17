import { ApiForm } from '../../components/ApiForm';

export default function NoOrganization() {
  return (
    <main>
      <header className="masthead"><h1>No organization</h1></header>
      <section className="card">
        <p>Your account does not belong to an organization. If you were removed by mistake, ask the owner for a new invitation link and open it while signed in.</p>
        <ApiForm action="/api/auth/logout" submit="Sign out" then="/" secondary />
      </section>
    </main>
  );
}
