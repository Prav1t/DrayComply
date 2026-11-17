import Link from 'next/link';
import { ApiForm } from '../../../../components/ApiForm';
import { Recompute } from '../../../../components/Recompute';
import { RECORDS_LABELS, RULE_LABELS, STATUS_LABELS, VERDICT_LABELS, verdictClass } from '../../../../lib/labels';
import { binderFor, getRun } from '../../../../server/assess';
import { atLeast } from '../../../../server/context';
import { load, pageContext, pageId } from '../../../../server/page';
import { listReports, organizationName } from '../../../../server/reports';
import { formatCents, totalsView } from '../../../../../../packages/report/src/index';

const STAGE = { template: 'The template is not complete', files: 'The files do not match the template', input: 'The data could not be used' } as const;

export default async function Run({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await pageContext();
  const id = pageId((await params).id);
  const run = await load(() => getRun(ctx, id));
  const reports = await listReports(ctx, run.id);
  const binder = binderFor(run, await organizationName(ctx), run.createdAt);
  const canEdit = atLeast(ctx.role, 'payroll');

  if (run.outcome.kind === 'stopped' || binder === null) {
    const errors = run.outcome.kind === 'stopped' ? run.outcome.errors : [];
    return (
      <>
        <p><Link href="/app/runs">All runs</Link></p>
        <section className="card">
          <h2>Run of {run.createdAt.slice(0, 16).replace('T', ' ')}</h2>
          <div className="banner bad" role="alert"><b>{run.outcome.kind === 'stopped' ? STAGE[run.outcome.stage] : 'This run cannot be shown'}.</b> Nothing was calculated.</div>
          <ul className="plain">{errors.map(e => <li key={e}>{e}</li>)}</ul>
          <p>Fix the <Link href={`/app/data/${run.datasetId}`}>data set</Link> and run again.</p>
        </section>
      </>
    );
  }
  const s = binder.summary;
  const totals = totalsView(s.aggregateShortfallCents, s.segregatedShortfallCents, s.periodsTotal, s.periodsNotComputable);
  return (
    <>
      <p><Link href="/app/runs">All runs</Link></p>
      {binder.header.unverifiedRatesNotice !== null && (
        <div className="banner bad" role="alert" data-testid="unverified-notice"><b>UNVERIFIED RATES - NOT FOR RELIANCE.</b> {binder.header.unverifiedRatesNotice} Every page of the report for this run is watermarked.</div>
      )}
      {binder.pendingLegalReview.length > 0 && (
        <div className="banner warn" data-testid="legal-notice"><b>Pending legal review.</b> This calculation relies on {binder.pendingLegalReview.length} reading(s) of the law that no lawyer has reviewed. They are listed at the bottom of this page and in the report.</div>
      )}
      <section className="card">
        <h2>Summary</h2>
        <div className="stats">
          <div className="stat"><b>{s.driversEvaluated}</b><span>drivers calculated</span></div>
          <div className="stat"><b>{s.byVerdict.no_shortfall_detected}</b><span>no shortfall detected</span></div>
          <div className="stat"><b>{s.byVerdict.shortfall_aggregate + s.byVerdict.shortfall_segregated_only}</b><span>with a shortfall</span></div>
          <div className="stat"><b>{s.byVerdict.insufficient_data}</b><span>insufficient data</span></div>
          <div className="stat"><b>{totals.aggregate}</b><span>short, aggregate comparison</span></div>
          <div className="stat"><b>{totals.segregated}</b><span>short, segregated comparison</span></div>
        </div>
        <p className="muted">{totals.coverage} The two comparisons are different readings of the same payments. Both are shown; neither is presented as the answer. Aggregate: everything paid against everything owed. Segregated: wait time and fuel must each be paid in full and cannot make up for low base pay.</p>
        {s.driversWithheld > 0 && <div className="banner warn">{s.driversWithheld} driver(s) were left out because rows in their records were rejected. No figure here covers them.</div>}
        <p className="muted">Run date {run.asOf} · engine {run.engineVersion} · rounding {run.rounding.replace('_', ' ')} · result fingerprint <code>{run.resultSha256.slice(0, 16)}…</code></p>
        <Recompute runId={run.id} />
      </section>

      <section className="card">
        <h2>Report</h2>
        <p className="muted">The audit binder is a PDF of everything on this page, with the input file fingerprints and the scope statement.</p>
        {canEdit && <ApiForm action={`/api/runs/${run.id}/reports`} submit="Generate the audit binder (PDF)" then="refresh" />}
        <ul className="plain">
          {reports.map(r => (
            <li key={r.id}><a href={`/api/reports/${r.id}`} data-testid="report-link">Download binder generated {r.generatedAt.slice(0, 16).replace('T', ' ')}</a>
              {' '}<span className="muted">{r.sizeBytes.toLocaleString('en-CA')} bytes, SHA-256 <code>{r.sha256.slice(0, 16)}…</code></span>
              {r.watermarked && <span className="pill bad">watermarked: unverified rates</span>}</li>
          ))}
          {reports.length === 0 && <li className="muted">No report generated yet.</li>}
        </ul>
      </section>

      <section className="card">
        <h2>What this result covers</h2>
        <ul className="plain">{binder.scope.map(x => <li key={x}>{x}</li>)}</ul>
        <p className="muted">Rate schedules used: {binder.schedules.map(x => `${x.id} (${x.status})`).join(', ') || 'none'}.</p>
      </section>

      {binder.worksheets.map(w => (
        <section className="card" key={w.driverId} data-testid={`driver-${w.driverId}`}>
          <h2>Driver {w.driverId}</h2>
          <p><span className={`pill ${verdictClass(w.verdict)}`}>{VERDICT_LABELS[w.verdict]}</span></p>
          <p className="muted">{RECORDS_LABELS[w.recordsVerdict]}</p>
          {w.scope.map(n => <p className="muted" key={n.code}>Note: {n.sentence}</p>)}
          {w.gaps.map(g => <div className="banner warn" key={`${g.code}-${g.recordIds.join()}`}><b>Missing data.</b> {g.detail}</div>)}
          {w.periods.map(p => (
            <details key={p.payPeriodId} open={p.verdict !== 'no_shortfall_detected'}>
              <summary>Pay period {p.payPeriodId}: {VERDICT_LABELS[p.verdict]}</summary>
              <p>{p.statement}</p>
              <table>
                <tbody>{p.figures.map(f => <tr key={f.label}><th>{f.label}</th><td className="num">{f.value}</td></tr>)}</tbody>
              </table>
              {p.findings.map(f => <div className={`banner ${f.nature === 'informational' || f.nature === 'pending' || f.nature === 'rounding_only' ? 'note' : 'bad'}`} key={`${f.ruleId}-${f.recordIds.join()}`}><b>{RULE_LABELS[f.ruleId]}: {formatCents(f.amountCents)} ({f.nature.replace(/_/g, ' ')}).</b> {f.sentence}</div>)}
              {p.gaps.map(g => <div className="banner warn" key={`${g.code}-${g.recordIds.join()}`}><b>Missing data.</b> {g.detail}</div>)}
              <table>
                <thead><tr><th>Check</th><th>Outcome</th><th>Why</th></tr></thead>
                <tbody>{p.evaluations.map(e => <tr key={e.ruleId}><td>{RULE_LABELS[e.ruleId]}</td><td>{STATUS_LABELS[e.status]}</td><td className="muted">{e.reason}</td></tr>)}</tbody>
              </table>
            </details>
          ))}
        </section>
      ))}

      {binder.rejects.length > 0 && (
        <section className="card">
          <h2>Rejected rows</h2>
          <ul className="plain">{binder.rejects.slice(0, 200).map(r => <li key={`${r.file}-${r.rowNumber}-${r.field ?? ''}`}>{r.file} row {r.rowNumber}{r.field === null ? '' : `, ${r.field}`}: {r.reason}{r.raw === '' ? '' : ` (value: "${r.raw}")`}</li>)}</ul>
        </section>
      )}

      <section className="card">
        <h2>Readings of the law pending legal review</h2>
        {binder.pendingLegalReview.length === 0 ? <p>None.</p> : binder.pendingLegalReview.map(i => (
          <details key={i.id}>
            <summary>{i.id}: {i.title}</summary>
            <p><b>Reading used:</b> {i.reading}</p>
            <p><b>Other reading:</b> {i.alternative}</p>
          </details>
        ))}
      </section>
    </>
  );
}
