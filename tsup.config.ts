import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  target: 'node20',
  dts: true,
  clean: true,
  sourcemap: false,
  external: [
    '@lydell/node-pty',
    '@modelcontextprotocol/sdk',
    'express',
    'node-interception',
    'sharp',
    'zod',
  ],
});
