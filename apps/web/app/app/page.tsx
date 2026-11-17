import Link from 'next/link';
import { listRuns } from '../../server/assess';
import { listDatasets } from '../../server/datasets';
import { listDrivers } from '../../server/drivers';
import { pageContext } from '../../server/page';

export default async function Dashboard() {
  const { ctx } = await pageContext();
  const [drivers, datasets, runs] = await Promise.all([listDrivers(ctx), listDatasets(ctx), listRuns(ctx)]);
  const noClass = drivers.filter(d => d.classPeriods.length === 0).length;
  return (
    <>
      <section className="card">
        <h2>Where things stand</h2>
        <div className="stats">
          <div className="stat"><b>{drivers.length}</b><span>drivers on the roster</span></div>
          <div className="stat"><b>{datasets.length}</b><span>data sets</span></div>
          <div className="stat"><b>{runs.length}</b><span>runs</span></div>
        </div>
        {noClass > 0 && <div className="banner warn">{noClass} driver(s) have no class period. Their records will be rejected until one is set.</div>}
      </section>
      <section className="card">
        <h2>How a calculation is made</h2>
        <ol>
          <li><Link href="/app/drivers">Set up drivers</Link>: who they are and what class each was, from what date.</li>
          <li><Link href="/app/data">Upload a data set</Link>: pay periods, hours, trips and payments exported from your payroll and dispatch systems, then map the columns.</li>
          <li><Link href="/app/runs">Run the calculation</Link> and download the audit binder.</li>
        </ol>
        <p className="muted">A missing value is never filled in. It is reported as a gap, and the affected driver&apos;s result is &quot;insufficient data&quot;.</p>
      </section>
    </>
  );
}
