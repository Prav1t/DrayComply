import Link from 'next/link';
import { ApiForm } from '../../../../components/ApiForm';
import { DatasetCheck } from '../../../../components/DatasetCheck';
import { MappingStudio } from '../../../../components/MappingStudio';
import { atLeast } from '../../../../server/context';
import { getDataset } from '../../../../server/datasets';
import { load, pageContext, pageId } from '../../../../server/page';
import { listTemplates } from '../../../../server/templates';

export default async function Dataset({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await pageContext();
  const id = pageId((await params).id);
  const d = await load(() => getDataset(ctx, id));
  const templates = (await listTemplates(ctx, 'records')).map(t => ({ id: t.id, name: `${t.name} (v${t.version})` }));
  const canEdit = atLeast(ctx.role, 'payroll');
  return (
    <>
      <p><Link href="/app/data">All data sets</Link></p>
      <section className="card">
        <h2><span className="step">1</span>Files in &quot;{d.name}&quot;</h2>
        <p className="muted">Each file is stored exactly as received, with its SHA-256 fingerprint. Uploading a file with the same name replaces it here; the earlier version is kept for the runs that used it.</p>
        <table>
          <thead><tr><th>File</th><th>Size</th><th>SHA-256</th><th>Uploaded</th><th></th></tr></thead>
          <tbody>
            {d.files.map(f => (
              <tr key={f.uploadId}>
                <td><a href={`/api/uploads/${f.uploadId}`}>{f.name}</a></td><td className="num">{f.sizeBytes.toLocaleString('en-CA')} bytes</td>
                <td><code>{f.sha256.slice(0, 16)}…</code></td><td>{f.createdAt.slice(0, 10)}</td>
                <td>{canEdit && <ApiForm action={`/api/datasets/${d.id}/files?name=${encodeURIComponent(f.name)}`} method="DELETE" submit="Take out" then="refresh" secondary />}</td>
              </tr>
            ))}
            {d.files.length === 0 && <tr><td colSpan={5} className="muted">No files yet.</td></tr>}
          </tbody>
        </table>
        {canEdit && (
          <ApiForm action={`/api/datasets/${d.id}/files`} submit="Upload" then="refresh" multipart>
            <label>CSV or XLSX files, up to 10 MB each<input type="file" name="file" multiple accept=".csv,.xlsx" required /></label>
          </ApiForm>
        )}
      </section>
      <section className="card">
        <h2><span className="step">2</span>Map the columns</h2>
        <p className="muted">A template says which column feeds each field and what a blank cell means. Nothing is matched for you. Drivers are not mapped here: they come from the Drivers page.</p>
        {canEdit && d.files.length > 0
          ? <MappingStudio files={d.files.map(f => ({ uploadId: f.uploadId, name: f.name, format: f.format }))} templates={templates} />
          : <p className="muted">{d.files.length === 0 ? 'Upload files first.' : 'Your role cannot edit templates.'}</p>}
      </section>
      <section className="card">
        <h2><span className="step">3</span>Check the data</h2>
        <p className="muted">Reads every file through a template and lists each row that cannot be used, with the reason. Fix the file in your own system or spreadsheet, upload it again, and check again.</p>
        <DatasetCheck datasetId={d.id} templates={templates} canRun={canEdit} />
      </section>
    </>
  );
}
