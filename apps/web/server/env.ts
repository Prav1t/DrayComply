// The only place the app reads its environment. Secrets come from here and nowhere else.
export interface Env {
  readonly databaseUrl: string;
  readonly databaseCaCert: string | null;  // the managed database's CA certificate (PEM), when it uses a private CA
  readonly appUrl: string;                 // public origin, e.g. https://app.example.ca
  readonly signupOpen: boolean;            // false: a new account needs an invitation
  readonly clientIpHeader: string;         // header the host's proxy sets to the caller's address
  readonly errorWebhookUrl: string | null; // optional error tracker endpoint
  readonly production: boolean;
}

function required(name: string): string {
  const v = process.env[name];
  if (v === undefined || v.trim() === '') throw new Error(`environment variable ${name} is not set`);
  return v.trim();
}

let cached: Env | null = null;

export function env(): Env {
  if (cached !== null) return cached;
  const optional = (name: string): string | null => { const v = process.env[name]; return v === undefined || v.trim() === '' ? null : v.trim(); };
  cached = {
    databaseUrl: required('DATABASE_URL'),
    databaseCaCert: optional('DATABASE_CA_CERT'),
    appUrl: required('APP_URL').replace(/\/$/, ''),
    signupOpen: optional('SIGNUP_OPEN') === 'true',
    clientIpHeader: (optional('CLIENT_IP_HEADER') ?? 'x-forwarded-for').toLowerCase(),
    errorWebhookUrl: optional('ERROR_WEBHOOK_URL'),
    production: process.env['NODE_ENV'] === 'production',
  };
  return cached;
}

// Tests swap the environment between cases.
export const resetEnvForTests = (): void => { cached = null; };
