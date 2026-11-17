import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 32_768, R = 8, P = 1, KEY_BYTES = 32;

const derive = (password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> =>
  new Promise((resolve, reject) => scrypt(password.normalize('NFKC'), salt, KEY_BYTES, { N: n, r, p, maxmem: 128 * 1024 * 1024 }, (err, key) => (err === null ? resolve(key) : reject(err))));

// scrypt with a per-password salt. The parameters are stored with the hash so they can be raised later.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || n === undefined || r === undefined || p === undefined || salt === undefined || key === undefined) return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const newToken = (): string => randomBytes(32).toString('base64url');
export const sha256Hex = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');

// Stable JSON: object keys sorted at every depth, so equal values always hash the same.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
