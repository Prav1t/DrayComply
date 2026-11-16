import type { Cell, Grid } from './types';

export type CsvResult =
  | { readonly kind: 'ok'; readonly grid: Grid }
  | { readonly kind: 'error'; readonly message: string };

// RFC 4180: quoted fields, doubled quotes, CR LF or LF. Text is kept exactly; nothing is trimmed here.
export function parseCsv(bytes: Uint8Array, delimiter: ',' | ';' | '\t'): CsvResult {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { kind: 'error', message: 'the file is not valid UTF-8 text' };
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);   // byte order mark

  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = '';
  let quoted = false;
  let wasQuoted = false;
  const endField = (): void => { row.push({ kind: 'text', text: field }); field = ''; wasQuoted = false; };
  const endRow = (): void => { endField(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? '';
    if (quoted) {
      if (ch !== '"') { field += ch; continue; }
      if (text[i + 1] === '"') { field += '"'; i += 1; continue; }
      quoted = false;
      continue;
    }
    if (ch === '"' && field === '' && !wasQuoted) { quoted = true; wasQuoted = true; continue; }
    if (ch === delimiter) { endField(); continue; }
    if (ch === '\r' && text[i + 1] === '\n') continue;
    if (ch === '\n' || ch === '\r') { endRow(); continue; }
    field += ch;
  }
  if (quoted) return { kind: 'error', message: 'a quoted field is never closed' };
  if (field !== '' || row.length > 0 || wasQuoted) endRow();   // last line without a newline
  return { kind: 'ok', grid: { rows, date1904: false } };
}
