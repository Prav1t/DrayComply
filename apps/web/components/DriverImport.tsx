'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Reject, SourceFile } from '../../../packages/ingest/src/index';
import { TemplateBuilder } from './TemplateBuilder';

interface Props { readonly templates: readonly { id: string; name: string }[] }
type Outcome = { kind: 'idle' } | { kind: 'done'; text: string } | { kind: 'refused'; errors: readonly string[]; rejects: readonly Reject[] };

const isReject = (v: unknown): v is Reject => v !== null && typeof v === 'object' && 'rowNumber' in v && 'reason' in v && 'file' in v;

// The file is read in the browser to build the mapping, then sent with the mapping to be imported.
export function DriverImport({ templates }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<{ source: SourceFile; original: File } | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });

  const choose = async (f: File | undefined): Promise<void> => {
    setOutcome({ kind: 'idle' });
    if (f === undefined) { setFile(null); return; }
    const format = f.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv';
    setFile({ source: { name: f.name, format, bytes: new Uint8Array(await f.arrayBuffer()) }, original: f });
  };
  const send = async (fields: Record<string, string>): Promise<void> => {
    if (file === null) return;
    const form = new FormData();
    form.append('file', file.original, file.original.name);
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    const res = await fetch('/api/drivers/import', { method: 'POST', body: form });
    const reply: unknown = await res.json().catch(() => ({}));
    const get = (k: string): unknown => (reply !== null && typeof reply === 'object' ? Reflect.get(reply, k) : undefined);
    if (res.ok) { setOutcome({ kind: 'done', text: `Imported: ${String(get('created'))} new, ${String(get('updated'))} updated.` }); router.refresh(); return; }
    const errors = get('errors');
    const rejects = get('rejects');
    setOutcome({ kind: 'refused', errors: Array.isArray(errors) ? errors.map(String) : [String(get('error') ?? 'The import failed.')], rejects: Array.isArray(rejects) ? rejects.filter(isReject) : [] });
  };

  return (
    <div>
      <div className="row">
        <label>Driver file (CSV or XLSX)<input type="file" accept=".csv,.xlsx" onChange={e => { void choose(e.target.files?.[0]); }} /></label>
        {templates.length > 0 && (
          <label>Saved driver template
            <select value={templateId} onChange={e => setTemplateId(e.target.value)}><option value="">Build a new one below</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          </label>
        )}
        {templateId !== '' && <button type="button" disabled={file === null} onClick={() => { void send({ templateId }); }}>Import with this template</button>}
      </div>
      {file !== null && templateId === '' && (
        <TemplateBuilder files={[file.source]} initial={null} tables={['drivers']} useLabel="Import drivers with this mapping"
          onUse={template => { void send({ template: JSON.stringify(template) }); }} />
      )}
      {outcome.kind === 'done' && <div className="banner note">{outcome.text}</div>}
      {outcome.kind === 'refused' && (
        <div className="banner bad" role="alert">
          <b>Nothing was imported.</b>
          <ul className="plain">{outcome.errors.map(e => <li key={e}>{e}</li>)}</ul>
          {outcome.rejects.length > 0 && <ul className="plain">{outcome.rejects.slice(0, 50).map(r => <li key={`${r.rowNumber}-${r.field ?? ''}`}>{r.file} row {r.rowNumber}{r.field === null ? '' : `, ${r.field}`}: {r.reason}{r.raw === '' ? '' : ` (value: "${r.raw}")`}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
