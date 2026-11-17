'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';

interface Props {
  readonly action: string;
  readonly method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly submit: string;
  readonly then: 'refresh' | string;              // 'refresh', or a path; "{id}" is replaced by the id in the reply
  readonly multipart?: boolean;
  readonly confirmText?: string;
  readonly secondary?: boolean;
  readonly children?: ReactNode;
  readonly show?: readonly string[];              // reply fields to show after success, e.g. an invitation link
}

// Posts a form to an API route and shows the reply's error, if any. No value is changed on the way.
export function ApiForm({ action, method = 'POST', submit, then, multipart = false, confirmText, secondary = false, children, show = [] }: Props) {
  const router = useRouter();
  const [error, setError] = useState<{ message: string; details: readonly string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Readonly<Record<string, string>>>({});

  const onSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (confirmText !== undefined && !window.confirm(confirmText)) return;
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError(null);
    try {
      const body = multipart ? form : JSON.stringify(Object.fromEntries([...form.entries()].filter((x): x is [string, string] => typeof x[1] === 'string')));
      const res = await fetch(action, { method, body, headers: multipart ? {} : { 'content-type': 'application/json' } });
      const reply: unknown = await res.json().catch(() => ({}));
      const field = (key: string): unknown => (reply !== null && typeof reply === 'object' ? Reflect.get(reply, key) : undefined);
      if (!res.ok) {
        const details = field('details');
        setError({ message: typeof field('error') === 'string' ? String(field('error')) : 'The request failed.', details: Array.isArray(details) ? details.map(String) : [] });
        return;
      }
      setShown(Object.fromEntries(show.map(k => [k, String(field(k) ?? '')])));
      formElement.reset();
      if (then === 'refresh') router.refresh(); else { router.push(then.replace('{id}', String(field('id') ?? ''))); router.refresh(); }
    } catch {
      setError({ message: 'The server could not be reached.', details: [] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={e => { void onSubmit(e); }}>
      <div className="row">
        {children}
        <button type="submit" className={secondary ? 'secondary' : undefined} disabled={busy}>{busy ? 'Working…' : submit}</button>
      </div>
      {error !== null && (
        <div className="banner bad" role="alert">{error.message}
          {error.details.length > 0 && <ul className="plain">{error.details.slice(0, 20).map(d => <li key={d}>{d}</li>)}</ul>}
        </div>
      )}
      {Object.entries(shown).filter(([, v]) => v !== '').map(([k, v]) => <div key={k} className="banner note"><b>{k}:</b> <code>{v}</code></div>)}
    </form>
  );
}
