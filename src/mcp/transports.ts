import express from 'express';
import type { ServerConfig, TransportMode } from '../config';
import { ensureTraceDirs } from '../trace/trace';
import { registerMcpHttpRoutes } from './mcpHttp';
import { registerSseRoutes } from './sseHttp';
import { startStdio } from './stdioTransport';

const startHttpServer = async (config: ServerConfig, host: string, port: number, mode: TransportMode) => {
  ensureTraceDirs(config);
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  if (mode === 'mcp' || mode === 'all') registerMcpHttpRoutes(app, config);
  if (mode === 'sse' || mode === 'all') registerSseRoutes(app, config, host, port);
  app.get('/health', (_req, res) => res.json({ ok: true, transport: mode }));
  await new Promise<void>((resolve) => {
    app.listen(port, host, () => {
      process.stderr.write(`computer-use-windows ${mode} listening on http://${host}:${port}\n`);
      resolve();
    });
  });
};

export const startTransport = async (config: ServerConfig, mode: TransportMode) => {
  if (mode === 'stdio') {
    await startStdio(config);
    return;
  }
  const host = mode === 'sse' ? config.sseHost : config.httpHost;
  const port = mode === 'sse' ? config.ssePort : config.httpPort;
  await startHttpServer(config, host, port, mode);
};
