'use client';

import { useState } from 'react';

// Runs the stored input through the engine again and says whether the stored result is reproduced exactly.
export function Recompute({ runId }: { runId: string }) {
  const [text, setText] = useState('');
  const check = async (): Promise<void> => {
    setText('Recomputing…');
    const res = await fetch(`/api/runs/${runId}/recompute`, { method: 'POST' });
    const reply: unknown = await res.json().catch(() => ({}));
    const get = (k: string): unknown => (reply !== null && typeof reply === 'object' ? Reflect.get(reply, k) : undefined);
    if (!res.ok) { setText('The run could not be recomputed.'); return; }
    setText(get('matches') === true
      ? `Recomputed from the stored input: the result is identical (engine ${String(get('currentEngineVersion'))}).`
      : `Recomputed from the stored input: the result DIFFERS. Stored with engine ${String(get('storedEngineVersion'))}, recomputed with ${String(get('currentEngineVersion'))}. The stored run is unchanged; make a new run to use the current engine and rates.`);
  };
  return <p><button type="button" className="secondary" onClick={() => { void check(); }}>Recompute and compare</button> <span className="muted" role="status">{text}</span></p>;
}
