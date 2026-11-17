import Link from 'next/link';
import { redirect } from 'next/navigation';
import { pageSession } from '../server/page';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if ((await pageSession()) !== null) redirect('/app');
  return (
    <main>
      <header className="masthead">
        <h1>DrayComply</h1>
        <p>Recompute container trucking driver payments against the regulated rates, and see shortfalls before an auditor does.</p>
      </header>
      <section className="card">
        <p>Upload your payroll and trip exports, map the columns once, run a calculation, and download an audit binder.</p>
        <div className="row">
          <Link className="button" href="/login">Sign in</Link>
          <Link className="button secondary" href="/signup">Create an account</Link>
          <Link className="button secondary" href="/try">Try it in this browser, nothing uploaded</Link>
        </div>
      </section>
      <footer>
        Results are calculations under the rules as encoded, for the data provided. They are not legal advice.
        {' '}<Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
      </footer>
    </main>
  );
}
