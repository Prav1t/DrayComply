// The wrapper every API route goes through: origin check, sign-in, role, error mapping, logging.
import { randomUUID } from 'node:crypto';
import type { Role } from '../../../packages/db/src/index';
import { SESSION_COOKIE, type Session } from './auth';
import { contextFor, requireRole, sessionFromToken, type Ctx } from './context';
import { env } from './env';
import { AppError, invalid, pgCode, reportError } from './errors';
import { LIMITS } from './limits';
import { log } from './log';

export type Params = Readonly<Record<string, string>>;
type NextContext = { params: Promise<Record<string, string | string[] | undefined>> };

export function cookieToken(req: Request): string | null {
  const header = req.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=');
  }
  return null;
}

export function clientAddress(req: Request): string {
  return (req.headers.get(env().clientIpHeader) ?? '').split(',')[0]?.trim() || 'unknown';
}

// A state-changing request must come from this site. Browsers always send Origin on such requests.
function checkOrigin(req: Request): void {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  if (req.headers.get('origin') !== env().appUrl) throw new AppError(403, 'bad_origin', 'This request did not come from the application.');
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > LIMITS.maxJsonBytes) throw new AppError(413, 'too_large', 'The request is too large.');
  let parsed: unknown;
  try { parsed = JSON.parse(text === '' ? '{}' : text); } catch { throw invalid('The request body is not valid JSON.'); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw invalid('The request body must be a JSON object.');
  return Object.fromEntries(Object.entries(parsed));
}

export function str(body: Readonly<Record<string, unknown>>, key: string, max: number = LIMITS.maxTextLength): string {
  const v = body[key];
  if (typeof v !== 'string' || v.trim() === '') throw invalid(`"${key}" is required.`);
  if (v.length > max) throw invalid(`"${key}" is too long.`);
  return v.trim();
}
export function optionalStr(body: Readonly<Record<string, unknown>>, key: string, max: number = LIMITS.maxTextLength): string | null {
  const v = body[key];
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw invalid(`"${key}" must be text.`);
  if (v.length > max) throw invalid(`"${key}" is too long.`);
  return v.trim() === '' ? null : v.trim();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// An id that is not a UUID cannot name a row, so it is "not found", never a database error.
export function uuidParam(params: Params, key: string): string {
  const v = params[key] ?? '';
  if (!UUID.test(v)) throw new AppError(404, 'not_found', 'Not found.');
  return v;
}
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

function fail(error: unknown): Response {
  if (error instanceof AppError) return json({ error: error.message, code: error.code, details: error.details }, error.status);
  return json({ error: 'Something went wrong. The problem has been recorded.', code: 'internal' }, 500);
}

type Access = { readonly kind: 'public' } | { readonly kind: 'signed_in' } | { readonly kind: 'member'; readonly role: Role };

export interface Call { readonly req: Request; readonly params: Params; readonly now: Date; readonly session: Session | null }
export interface MemberCall extends Call { readonly ctx: Ctx }

type Handler = (req: Request, context: NextContext) => Promise<Response>;

async function run(name: string, req: Request, context: NextContext, access: Access, work: (call: Call, ctx: Ctx | null) => Promise<Response>): Promise<Response> {
  const requestId = randomUUID();
  const started = Date.now();
  const now = new Date(started);
  let status = 500;
  let ids: { organizationId?: string; userId?: string } = {};
  try {
    checkOrigin(req);
    const length = Number(req.headers.get('content-length') ?? '0');
    if (length > LIMITS.maxRequestBytes) throw new AppError(413, 'too_large', 'The request is too large.');
    // At run time Next passes no params to a route without a dynamic segment, whatever its types say.
    const raw = (await context.params) ?? {};
    const params: Params = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v.join('/') : v ?? '']));
    const session = access.kind === 'public' ? await sessionFromToken(cookieToken(req), now).catch(() => null) : await sessionFromToken(cookieToken(req), now);
    if (access.kind !== 'public' && session === null) throw new AppError(401, 'signed_out', 'Sign in to continue.');
    let ctx: Ctx | null = null;
    if (access.kind === 'member') {
      ctx = await contextFor(session, now);
      requireRole(ctx, access.role);
      ids = { organizationId: ctx.organizationId, userId: ctx.userId };
    }
    const res = await work({ req, params, now, session }, ctx);
    status = res.status;
    return res;
  } catch (error) {
    if (!(error instanceof AppError)) await reportError(error, { route: name, requestId });
    const res = fail(pgCode(error) === 'DC001' ? new AppError(409, 'immutable', 'This record cannot be changed.') : error);
    status = res.status;
    return res;
  } finally {
    log(status >= 500 ? 'error' : 'info', { event: 'request', route: name, method: req.method, status, ms: Date.now() - started, requestId, ...ids });
  }
}

// name is the route pattern, never the URL, so no identifier a user typed reaches the logs through it.
export const memberRoute = (name: string, role: Role, work: (call: MemberCall) => Promise<Response>): Handler =>
  (req, context) => run(name, req, context, { kind: 'member', role }, (call, ctx) => {
    if (ctx === null) throw new Error('member route without a context');
    return work({ ...call, ctx });
  });

export const openRoute = (name: string, access: 'public' | 'signed_in', work: (call: Call) => Promise<Response>): Handler =>
  (req, context) => run(name, req, context, { kind: access }, call => work(call));

export interface Multipart { readonly files: readonly { readonly name: string; readonly bytes: Uint8Array }[]; readonly fields: Readonly<Record<string, string>> }

// Reads a multipart form. Each file is capped before its bytes are copied.
export async function readMultipart(req: Request): Promise<Multipart> {
  let form: FormData;
  try { form = await req.formData(); } catch { throw invalid('The upload could not be read.'); }
  const files: { name: string; bytes: Uint8Array }[] = [];
  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') { fields[key] = value; continue; }
    if (value.size > LIMITS.maxFileBytes) throw invalid(`${value.name}: the file is larger than ${LIMITS.maxFileBytes / (1024 * 1024)} MB.`);
    files.push({ name: value.name, bytes: new Uint8Array(await value.arrayBuffer()) });
  }
  return { files, fields };
}

export const download = (bytes: Uint8Array, contentType: string, filename: string): Response =>
  new Response(Buffer.from(bytes), { status: 200, headers: {
    'content-type': contentType, 'content-length': String(bytes.length), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    'content-disposition': `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
  } });
