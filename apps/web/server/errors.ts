import { env } from './env';
import { log } from './log';

// An error the caller may see. Anything else is reported and shown as a generic failure.
export class AppError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details: readonly string[] = []) {
    super(message);
    this.name = 'AppError';
  }
}
export const notFound = (): AppError => new AppError(404, 'not_found', 'Not found.');
export const forbidden = (): AppError => new AppError(403, 'forbidden', 'Your role does not allow this.');
export const invalid = (message: string, details: readonly string[] = []): AppError => new AppError(400, 'invalid', message, details);

// Error tracking hook. Sends the error's name and where it happened, never its message or any request data.
export async function reportError(error: unknown, where: { readonly route: string; readonly requestId: string }): Promise<void> {
  const errorName = error instanceof Error ? error.name : 'non_error';
  // The first stack frame says where it broke. The message is left out: it can quote a value from a file or a row.
  const frame = error instanceof Error ? (error.stack ?? '').split('\n').find(l => l.trimStart().startsWith('at ')) ?? '' : '';
  log('error', { event: 'unhandled_error', route: where.route, requestId: where.requestId, errorName, code: pgCode(error), where: frame.trim() });
  const url = safeEnvWebhook();
  if (url === null) return;
  try {
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ app: 'draycomply', errorName, route: where.route, requestId: where.requestId }) });
  } catch {
    log('warn', { event: 'error_webhook_failed', requestId: where.requestId });
  }
}

function safeEnvWebhook(): string | null {
  try { return env().errorWebhookUrl; } catch { return null; }
}

// The SQLSTATE of a database error, wherever the driver put it.
export function pgCode(error: unknown): string | null {
  for (let e: unknown = error, depth = 0; e instanceof Error && depth < 4; e = e.cause, depth += 1) {
    const code: unknown = Reflect.get(e, 'code');
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return null;
}
