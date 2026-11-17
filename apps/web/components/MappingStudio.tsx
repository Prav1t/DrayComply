'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TABLE_KINDS, type SourceFile } from '../../../packages/ingest/src/index';
import { TemplateBuilder } from './TemplateBuilder';

interface Props {
  readonly files: readonly { uploadId: string; name: string; format: 'csv' | 'xlsx' }[];
  readonly templates: readonly { id: string; name: string }[];
}

const RECORD_TABLES = TABLE_KINDS.filter(k => k !== 'drivers' && k !== 'otherLicenseeHours');

// Loads the stored files into the browser so the builder can show their columns, then saves the template as a new version.
export function MappingStudio({ files, templates }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<{ files: SourceFile[]; initial: unknown } | null>(null);
  const [message, setMessage] = useState<{ kind: 'note' | 'bad'; text: string } | null>(null);
  const [startFrom, setStartFrom] = useState('');

  const start = async (): Promise<void> => {
    setMessage(null);
    try {
      const loaded = await Promise.all(files.map(async f => {
        const res = await fetch(`/api/uploads/${f.uploadId}`);
        if (!res.ok) throw new Error('file');
        return { name: f.name, format: f.format, bytes: new Uint8Array(await res.arrayBuffer()) };
      }));
      let initial: unknown = null;
      if (startFrom !== '') {
        const res = await fetch(`/api/templates/${startFrom}`);
        const reply: unknown = await res.json();
        initial = reply !== null && typeof reply === 'object' ? Reflect.get(reply, 'template') : null;
      }
      setOpen({ files: loaded, initial });
    } catch {
      setMessage({ kind: 'bad', text: 'The files could not be loaded.' });
    }
  };
  const save = async (template: unknown): Promise<void> => {
    const res = await fetch('/api/templates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ template, purpose: 'records' }) });
    const reply: unknown = await res.json().catch(() => ({}));
    const get = (k: string): unknown => (reply !== null && typeof reply === 'object' ? Reflect.get(reply, k) : undefined);
    if (!res.ok) { setMessage({ kind: 'bad', text: String(get('error') ?? 'The template could not be saved.') }); return; }
    setMessage({ kind: 'note', text: `Template saved as version ${String(get('version'))}. Choose it in step 3.` });
    setOpen(null);
    router.refresh();
  };

  return (
    <div>
      {open === null && (
        <div className="row">
          {templates.length > 0 && (
            <label>Start from
              <select value={startFrom} onChange={e => setStartFrom(e.target.value)}><option value="">A blank template</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </label>
          )}
          <button type="button" className="secondary" onClick={() => { void start(); }}>{startFrom === '' ? 'Build a template from these files' : 'Edit this template'}</button>
        </div>
      )}
      {templates.length > 0 && open === null && <p className="muted">Saved templates: {templates.map(t => t.name).join(', ')}.</p>}
      {open !== null && <TemplateBuilder files={open.files} initial={open.initial} tables={RECORD_TABLES} useLabel="Save this template" onUse={t => { void save(t); }} />}
      {message !== null && <div className={`banner ${message.kind}`}>{message.text}</div>}
    </div>
  );
}
