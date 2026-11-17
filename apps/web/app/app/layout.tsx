import Link from 'next/link';
import type { ReactNode } from 'react';
import { ApiForm } from '../../components/ApiForm';
import { OrgSwitch } from '../../components/OrgSwitch';
import { pageContext } from '../../server/page';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { ctx, session, organizations } = await pageContext();
  const current = organizations.find(o => o.id === ctx.organizationId);
  return (
    <main>
      <header className="masthead appbar">
        <h1><Link href="/app">DrayComply</Link></h1>
        <nav className="mainnav" aria-label="Main">
          <Link href="/app/drivers">1. Drivers</Link>
          <Link href="/app/data">2. Data</Link>
          <Link href="/app/runs">3. Runs</Link>
          <Link href="/app/settings">Settings</Link>
        </nav>
        <div className="who">
          <span>{current?.name ?? ''} · {session.email} · {ctx.role}</span>
          {organizations.length > 1 && <OrgSwitch current={ctx.organizationId} organizations={organizations.map(o => ({ id: o.id, name: o.name }))} />}
          <ApiForm action="/api/auth/logout" submit="Sign out" then="/" secondary />
        </div>
      </header>
      {current?.isDemo === true && <div className="banner note"><b>Demonstration organization.</b> Every driver, file and figure here is fictional.</div>}
      {children}
      <footer>
        Results are calculations under the rules as encoded, for the data provided. They are not legal advice.
        {' '}<Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
      </footer>
    </main>
  );
}
