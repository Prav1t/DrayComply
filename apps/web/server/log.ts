// Structured logs. Only the fields listed here are ever written, so customer data cannot leak into logs.
const ALLOWED = ['event', 'requestId', 'route', 'method', 'status', 'ms', 'organizationId', 'userId', 'entity', 'entityId', 'count', 'bytes', 'code', 'errorName', 'stage', 'where'] as const;
type Field = (typeof ALLOWED)[number];
export type LogFields = Partial<Record<Field, string | number | null>>;

type Sink = (line: string) => void;
// eslint-disable-next-line no-console
let sink: Sink = line => console.log(line);
export const setLogSinkForTests = (s: Sink | null): void => {
  // eslint-disable-next-line no-console
  sink = s ?? (line => console.log(line));
};

// Unknown keys are dropped, not logged. Values are identifiers, counts and codes only.
export function log(level: 'info' | 'warn' | 'error', fields: Readonly<Record<string, unknown>>): void {
  const out: Record<string, string | number | null> = { level, at: new Date().toISOString() };
  for (const key of ALLOWED) {
    const v = fields[key];
    if (typeof v === 'string') out[key] = v.slice(0, 200);
    else if (typeof v === 'number' || v === null) out[key] = v;
  }
  sink(JSON.stringify(out));
}
