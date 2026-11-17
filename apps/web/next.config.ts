import type { NextConfig } from 'next';

const production = process.env['NODE_ENV'] === 'production';

// Next's own inline bootstrap scripts need 'unsafe-inline'; development also needs eval for hot reload.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(production ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
];

// The packages live outside this folder and are compiled from source.
const config: NextConfig = {
  experimental: { externalDir: true },
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  outputFileTracingIncludes: { '/**': ['../../packages/db/migrations/**'] },
  ...(process.env['NEXT_OUTPUT'] === 'standalone' ? { output: 'standalone' as const } : {}),
  serverExternalPackages: ['pg'],
  poweredByHeader: false,
  headers: async () => [
    { source: '/:path*', headers: securityHeaders },
    // Signed-in pages and API replies are never cached by a browser or a proxy.
    { source: '/app/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
  ],
};
export default config;
