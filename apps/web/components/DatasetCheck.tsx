'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CheckResult } from '../server/assess';

interface Props { readonly datasetId: string; readonly templates: readonly { id: string; name: string }[]; readonly canRun: boolean }

const isCheck = (v: unknown): v is CheckResult => v !== null && typeof v === 'object' && 'kind' in v && (v.kind === 'stopped' || v.kind === 'read');

export function DatasetCheck({ datasetId, templates, canRun }: Props) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (): Promise<void> => {
    setBusy(true); setError(''); setResult(null);
    try {
      const res = await fetch(`/api/datasets/${datasetId}/check`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templateId }) });
      const reply: unknown = await res.json();
      if (res.ok && isCheck(reply)) setResult(reply); else setError('The check could not be run.');
    } catch { setError('The server could not be reached.'); } finally { setBusy(false); }
  };

  if (templates.length === 0) return <p className="muted">Save a template in step 2 first.</p>;
  return (
    <div>
      <div className="row">
        <label>Template
          <select value={templateId} onChange={e => { setTemplateId(e.target.value); setResult(null); }}>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </label>
        <button type="button" className="secondary" disabled={busy} onClick={() => { void run(); }}>{busy ? 'Checking…' : 'Check the data'}</button>
      </div>
      {error !== '' && <div className="banner bad" role="alert">{error}</div>}
      {result !== null && result.kind === 'stopped' && (
        <div className="banner bad" role="alert">
          <b>{result.stage === 'template' ? 'The template is not complete' : 'The files do not match the template'}.</b> Nothing was read.
          <ul className="plain">{result.errors.map(e => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      {result !== null && result.kind === 'read' && (
        <>
          <div className={`banner ${result.ingest.rejects.length === 0 ? 'note' : 'warn'}`}>{result.ingest.statement}</div>
          {result.driversWithoutClass.length > 0 && <div className="banner warn">These drivers have no class period, so their records are rejected: {result.driversWithoutClass.join(', ')}. <Link href="/app/drivers">Set their class</Link>.</div>}
          <table>
            <thead><tr><th>File</th><th>Table</th><th>Rows accepted</th></tr></thead>
            <tbody>{result.ingest.manifest.flatMap(m => m.tables.map(t => <tr key={`${m.name}-${t.table}`}><td>{m.name}</td><td>{t.table}</td><td className="num">{t.acceptedRows} of {t.dataRows}</td></tr>))}</tbody>
          </table>
          {result.ingest.withheldDrivers.length > 0 && <p><b>Drivers left out of a run until their rows are fixed:</b> {result.ingest.withheldDrivers.map(d => `${d.driverId} (${d.rejectedRows} row(s))`).join(', ')}</p>}
          {result.ingest.rejects.length > 0 && (
            <div className="scroll">
              <table>
                <thead><tr><th>File</th><th>Row</th><th>Field</th><th>Driver</th><th>Value</th><th>Why it was rejected</th></tr></thead>
                <tbody>{result.ingest.rejects.slice(0, 500).map(r => (
                  <tr key={`${r.file}-${r.rowNumber}-${r.field ?? ''}-${r.reason}`} className="rejected"><td>{r.file}</td><td className="num">{r.rowNumber}</td><td>{r.field ?? ''}</td><td>{r.driverId ?? 'unknown'}</td><td><code>{r.raw}</code></td><td>{r.reason}</td></tr>
                ))}</tbody>
              </table>
              {result.ingest.rejects.length > 500 && <p className="muted">Showing the first 500 of {result.ingest.rejects.length}.</p>}
            </div>
          )}
          <p>{result.drivers.length} driver(s) can be calculated. {canRun && <Link className="button" href={`/app/runs/new?dataset=${datasetId}&template=${templateId}`}>Continue to run</Link>}</p>
        </>
      )}
    </div>
  );
}
