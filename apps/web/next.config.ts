import type { NextConfig } from 'next';

// The packages live outside this folder and are compiled from source.
const config: NextConfig = { experimental: { externalDir: true }, outputFileTracingRoot: new URL('../..', import.meta.url).pathname };
export default config;
