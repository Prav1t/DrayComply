import Link from 'next/link';
import { ApiForm } from '../../../../components/ApiForm';
import { requireRole } from '../../../../server/context';
import { listDatasets } from '../../../../server/datasets';
import { load, pageContext } from '../../../../server/page';
import { listTemplates } from '../../../../server/templates';

export default async function NewRun({ searchParams }: { searchParams: Promise<{ dataset?: string; template?: string }> }) {
  const { ctx } = await pageContext();
  const chosen = await searchParams;
  const [datasets, templates] = await load(async () => { requireRole(ctx, 'viewer'); return Promise.all([listDatasets(ctx), listTemplates(ctx, 'records')]); });
  // The run date is read from the server clock here, in the app layer, and passed down as an argument.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver' }).format(ctx.now);
  if (datasets.length === 0 || templates.length === 0) {
    return <section className="card"><h2>New run</h2><p>You need a <Link href="/app/data">data set with a saved template</Link> first.</p></section>;
  }
  return (
    <section className="card">
      <h2>New run</h2>
      <ApiForm action="/api/runs" submit="Run calculation" then="/app/runs/{id}">
        <label>Data set
          <select name="datasetId" defaultValue={chosen.dataset ?? datasets[0]?.id}>{datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        </label>
        <label>Template
          <select name="templateId" defaultValue={chosen.template ?? templates[0]?.id}>{templates.map(t => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}</select>
        </label>
        <label>Run date (a pay period not yet paid on this date is shown as pending)<input type="date" name="asOf" defaultValue={today} required /></label>
        <label>Report pay periods from (blank for all)<input type="date" name="periodFrom" /></label>
        <label>to<input type="date" name="periodTo" /></label>
        <label>Only these driver ids, separated by commas (blank for all)<input type="text" name="driverIds" /></label>
      </ApiForm>
      <ul className="plain muted">
        <li>Every pay period in the data is still calculated, so hours build up correctly. The range only limits what is reported.</li>
        <li>Rounding: half up, once per driver per pay period.</li>
        <li>The run uses the driver roster as it is right now, and keeps a copy of it.</li>
      </ul>
    </section>
  );
}
