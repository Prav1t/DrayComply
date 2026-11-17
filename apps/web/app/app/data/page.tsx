import Link from 'next/link';
import { ApiForm } from '../../../components/ApiForm';
import { atLeast } from '../../../server/context';
import { listDatasets } from '../../../server/datasets';
import { pageContext } from '../../../server/page';

export default async function Data() {
  const { ctx } = await pageContext();
  const datasets = await listDatasets(ctx);
  return (
    <>
      <section className="card">
        <h2>Data sets</h2>
        <p className="muted">A data set is one group of exports: pay periods, hours, trips, payments and, if you have them, deductions, callouts and fuel prices.</p>
        <ul className="plain">
          {datasets.map(d => <li key={d.id}><Link href={`/app/data/${d.id}`}>{d.name}</Link> <span className="muted">created {d.createdAt.slice(0, 10)}</span></li>)}
          {datasets.length === 0 && <li className="muted">No data sets yet.</li>}
        </ul>
      </section>
      {atLeast(ctx.role, 'payroll') && (
        <section className="card">
          <h2>New data set</h2>
          <ApiForm action="/api/datasets" submit="Create data set" then="/app/data/{id}">
            <label>Name, for example &quot;July to September 2026&quot;<input type="text" name="name" required /></label>
          </ApiForm>
        </section>
      )}
    </>
  );
}
