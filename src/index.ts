#!/usr/bin/env node
import { loadConfig, type TransportMode } from './config';
import { prepareRuntimeDirs } from './trace/trace';
import { startTransport } from './mcp/transports';

const validModes = new Set<TransportMode>(['all', 'mcp', 'sse', 'stdio']);

const transportMode = (): TransportMode => {
  const value = process.argv.find((arg) => arg.startsWith('--transport='))?.split('=')[1]
    || process.argv[process.argv.findIndex((arg) => arg === '--transport' || arg === '-t') + 1]
    || 'stdio';
  if (!validModes.has(value as TransportMode)) throw new Error(`Unsupported transport: ${value}`);
  return value as TransportMode;
};

const main = async () => {
  const config = loadConfig();
  prepareRuntimeDirs(config);
  await startTransport(config, transportMode());
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
