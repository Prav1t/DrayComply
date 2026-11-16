'use client';

import { useState } from 'react';
import type { SourceFile } from '../../../packages/ingest/src/index';
import type { RoundingMode, Verdict } from '../../../packages/engine/src/index';
import { formatDelta, formatCents, recordsText, renderPdf, verdictText } from '../../../packages/report/src/index';
import { sampleFiles, sampleTemplate } from '../../../packages/ingest/src/testing/sample';
import { runPipeline, type PipelineResult } from '../lib/pipeline';

const PILL: Readonly<Record<Verdict, string>> = {
  no_shortfall_detected: 'ok', shortfall_aggregate: 'bad', shortfall_segregated_only: 'bad', insufficient_data: 'warn',
};
const STAGE = { template: 'The mapping template is not valid', files: 'The files do not fit the template', input: 'The engine refused the input' } as const;
const today = (): string => new Date().toLocaleDateString('en-CA');   // the browser's date, as YYYY-MM-DD

async function toSourceFile(file: File): Promise<SourceFile> {
  const format = file.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv';
  return { name: file.name, format, bytes: new Uint8Array(await file.arrayBuffer()) };
}

export function Workbench() {
  const [files, setFiles] = useState<readonly SourceFile[]>([]);
  const [template, setTemplate] = useState<unknown>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [licenseeName, setLicenseeName] = useState('');
  const [licenseeId, setLicenseeId] = useState('');
  const [asOf, setAsOf] = useState(today);
  const [rounding, setRounding] = useState<RoundingMode>('half_up');
  const [result, setResult] = useState<PipelineResult | null>(null);

  const ready = files.length > 0 && template !== null && licenseeName.trim() !== '' && licenseeId.trim() !== '';

  const addFiles = async (list: FileList | null): Promise<void> => {
    if (list === null) return;
    const added = await Promise.all([...list].map(toSourceFile));
    setFiles(current => [...current.filter(f => !added.some(a => a.name === f.name)), ...added]);
    setResult(null);
  };
  const loadTemplate = async (list: FileList | null): Promise<void> => {
    const file = list?.[0];
    if (file === undefined) return;
    try {
      setTemplate(JSON.parse(await file.text()));
      setTemplateName(file.name);
      setTemplateError('');
    } catch {
      setTemplate(null);
      setTemplateError(`${file.name} is not valid JSON.`);
    }
    setResult(null);
  };
  const loadSample = (): void => {
    setFiles(sampleFiles());
    setTemplate(sampleTemplate());
    setTemplateName('Sample template (built in)');
    setTemplateError('');
    setLicenseeName('Sample Drayage Ltd. (fictional)');
    setLicenseeId('SAMPLE-0000');
    setAsOf('2026-11-16');
    setResult(null);
  };
  const run = (): void => {
    setResult(runPipeline(files, template, { licenseeId: licenseeId.trim(), licenseeName: licenseeName.trim(), asOf, rounding, generatedAt: new Date().toISOString() }));
  };
  const downloadPdf = async (): Promise<void> => {
    if (result === null || result.kind !== 'completed') return;
    const pdf = await renderPdf(result.binder);
    const url = URL.createObjectURL(new Blob([pdf.slice().buffer], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `draycomply-binder-${result.binder.header.asOf}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <section className="card">
        <h2><span className="step">1</span>Files</h2>
        <div className="row">
          <label>Payroll and dispatch exports (CSV or XLSX)
            <input type="file" multiple accept=".csv,.xlsx" onChange={e => { void addFiles(e.target.files); }} />
          </label>
          <button type="button" className="secondary" onClick={loadSample}>Load the built-in sample</button>
        </div>
        <ul className="plain">
          {files.map(f => <li key={f.name}>{f.name} <span className="muted">({f.format}, {f.bytes.length.toLocaleString()} bytes)</span></li>)}
        </ul>
      </section>

      <section className="card">
        <h2><span className="step">2</span>Mapping template</h2>
        <label>Saved template (JSON)
          <input type="file" accept=".json,application/json" onChange={e => { void loadTemplate(e.target.files); }} />
        </label>
        {templateName !== '' && <p className="muted">Using: {templateName}</p>}
        {templateError !== '' && <div className="banner bad">{templateError}</div>}
        <p className="muted">The template says which column feeds each field and what a blank cell means. Nothing is guessed from the files.</p>
      </section>

      <section className="card">
        <h2><span className="step">3</span>Run</h2>
        <div className="row">
          <label>Licensee name<input type="text" value={licenseeName} onChange={e => setLicenseeName(e.target.value)} /></label>
          <label>Licence or reference number<input type="text" value={licenseeId} onChange={e => setLicenseeId(e.target.value)} /></label>
          <label>Run date<input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} /></label>
          <label>Rounding
            <select value={rounding} onChange={e => { const v = e.target.value; if (v === 'half_up' || v === 'half_even' || v === 'down' || v === 'up') setRounding(v); }}>
              <option value="half_up">Half up</option><option value="half_even">Half even</option><option value="down">Down</option><option value="up">Up</option>
            </select>
          </label>
          <button type="button" disabled={!ready} onClick={run}>Run calculation</button>
        </div>
        {!ready && <p className="muted">Add files, a template, and the licensee name and number to run.</p>}
      </section>

      {result !== null && result.kind === 'stopped' && (
        <section className="card">
          <div className="banner bad"><b>{STAGE[result.stage]}.</b> Nothing was calculated.</div>
          <ul className="plain">{result.errors.map(e => <li key={e}>{e}</li>)}</ul>
        </section>
      )}

      {result !== null && result.kind === 'completed' && <Results result={result} onDownload={() => { void downloadPdf(); }} />}
    </>
  );
}

function Results({ result, onDownload }: { result: Extract<PipelineResult, { kind: 'completed' }>; onDownload: () => void }) {
  const { binder, run, ingested } = result;
  const s = binder.summary;
  return (
    <>
      <section className="card">
        <h2>Summary</h2>
        {binder.header.unverifiedRatesNotice !== null && <div className="banner warn"><b>{binder.header.unverifiedRatesNotice}</b></div>}
        {(s.driversWithheld > 0 || s.unattributedRejects > 0) && <div className="banner warn">{ingested.statement}</div>}
        <div className="stats">
          <div className="stat"><b>{s.driversEvaluated}</b><span>Drivers evaluated</span></div>
          <div className="stat"><b>{s.driversWithheld}</b><span>Drivers withheld (rejected rows)</span></div>
          <div className="stat"><b>{formatCents(s.aggregateShortfallCents)}</b><span>Total short, aggregate comparison</span></div>
          <div className="stat"><b>{formatCents(s.segregatedShortfallCents)}</b><span>Total short, segregated comparison</span></div>
          <div className="stat"><b>{s.byVerdict.insufficient_data}</b><span>Drivers with insufficient data</span></div>
          <div className="stat"><b>{s.rejectedRows}</b><span>Rejected input rows</span></div>
        </div>
        <p className="muted">The two comparisons are different readings of the same payments. Both are shown; neither is presented as the answer.</p>
        <button type="button" onClick={onDownload}>Download the binder (PDF)</button>
      </section>

      <section className="card">
        <h2>Drivers</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>Driver</th><th>Pay period</th><th>Payment verdict</th><th>Records</th><th>Aggregate</th><th>Segregated</th><th>Detail</th></tr></thead>
            <tbody>
              {run.drivers.flatMap(d => d.periods.map(p => (
                <tr key={`${d.driverId}|${p.payPeriodId}`}>
                  <td>{d.driverId}</td>
                  <td>{p.payPeriodId}</td>
                  <td><span className={`pill ${PILL[p.verdict]}`}>{verdictText(p.verdict)}</span></td>
                  <td>{recordsText(p.recordsVerdict)}</td>
                  <td className="num">{formatDelta(p.aggregate)}</td>
                  <td className="num">{formatDelta(p.segregated)}</td>
                  <td>
                    {p.findings.length + p.gaps.length === 0 ? <span className="muted">No findings or gaps</span> : (
                      <details>
                        <summary>{p.findings.length} finding(s), {p.gaps.length} gap(s)</summary>
                        {p.findings.map(f => <p key={`${f.ruleId}|${f.recordIds.join()}`}><b>{f.ruleId}</b> ({f.nature.replace(/_/g, ' ')}, {formatCents(f.amountCents)}): {f.sentence}</p>)}
                        {p.gaps.map(g => <p key={`${g.code}|${g.recordIds.join()}`}><b>{g.code}</b>: {g.detail}</p>)}
                      </details>
                    )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
        {run.drivers.length === 0 && <p className="muted">No driver could be evaluated. See the rejected rows.</p>}
      </section>

      {binder.rejects.length > 0 && (
        <section className="card">
          <h2>Rejected rows</h2>
          <p className="muted">A rejected row is never repaired. Fix it in the source file and run again.</p>
          <div className="scroll">
            <table>
              <thead><tr><th>File</th><th>Row</th><th>Field</th><th>Value</th><th>Reason</th></tr></thead>
              <tbody>
                {binder.rejects.map(r => (
                  <tr key={`${r.file}|${r.rowNumber}|${r.field ?? ''}`}><td>{r.file}</td><td className="num">{r.rowNumber}</td><td>{r.field ?? ''}</td><td>{r.raw}</td><td>{r.reason}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Scope of this run</h2>
        <ul className="plain">{binder.scope.map(x => <li key={x}>{x}</li>)}</ul>
        <details>
          <summary>Schedules used and file hashes</summary>
          {binder.schedules.map(x => <p key={x.id}>{x.id}: {x.status}</p>)}
          {binder.manifest.map(m => <p key={m.name}>{m.name}<br /><code>sha256 {m.sha256}</code></p>)}
        </details>
      </section>
    </>
  );
}
