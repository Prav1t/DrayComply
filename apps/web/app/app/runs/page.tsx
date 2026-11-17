import Link from 'next/link';
import { listRuns, type RunSummary } from '../../../server/assess';
import { atLeast } from '../../../server/context';
import { pageContext } from '../../../server/page';
import { totalsView } from '../../../../../packages/report/src/index';

const isSummary = (v: unknown): v is RunSummary => v !== null && typeof v === 'object' && 'status' in v && 'binder' in v;

export default async function Runs() {
  const { ctx } = await pageContext();
  const runs = await listRuns(ctx);
  return (
    <section className="card">
      <h2>Runs</h2>
      <p className="muted">A run is never changed. Running again, after fixing data or a driver&apos;s class, makes a new run and keeps the old one.</p>
      {atLeast(ctx.role, 'payroll') && <p><Link className="button" href="/app/runs/new">New run</Link></p>}
      <div className="scroll">
        <table>
          <thead><tr><th>Run</th><th>Data set</th><th>Run date</th><th>Drivers</th><th>Shortfall, aggregate</th><th>Shortfall, segregated</th><th>Notes</th></tr></thead>
          <tbody>
            {runs.map(r => {
              const s = isSummary(r.summary) ? r.summary.binder : null;
              const totals = s === null ? null : totalsView(s.aggregateShortfallCents, s.segregatedShortfallCents, s.periodsTotal, s.periodsNotComputable);
              return (
                <tr key={r.id}>
                  <td><Link href={`/app/runs/${r.id}`}>{r.createdAt.slice(0, 16).replace('T', ' ')}</Link></td>
                  <td>{r.datasetName}</td><td>{r.asOf}</td>
                  <td className="num">{s?.driversEvaluated ?? ''}</td>
                  <td className="num">{totals?.aggregate ?? ''}</td><td className="num">{totals?.segregated ?? ''}</td>
                  <td>
                    {r.status === 'stopped' && <span className="pill bad">stopped</span>}
                    {r.unverifiedSchedulesUsed && <span className="pill bad">unverified rates</span>}
                    {s !== null && s.byVerdict.insufficient_data > 0 && <span className="pill warn">{s.byVerdict.insufficient_data} insufficient data</span>}
                  </td>
                </tr>
              );
            })}
            {runs.length === 0 && <tr><td colSpan={7} className="muted">No runs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
