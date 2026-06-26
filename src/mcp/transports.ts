import express from 'express';
import type { ServerConfig, TransportMode } from '../config';
import { ensureTraceDirs } from '../trace/trace';
import { registerMcpHttpRoutes } from './mcpHttp';
import { registerSseRoutes } from './sseHttp';
import { startStdio } from './stdioTransport';

const startHttpServer = async (config: ServerConfig, mode: TransportMode) => {
  ensureTraceDirs(config);
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  registerMcpHttpRoutes(app, config);
  registerSseRoutes(app, config);
  app.get('/health', (_req, res) => res.json({ ok: true, transport: mode }));
  await new Promise<void>((resolve) => {
    app.listen(config.port, config.host, () => {
      process.stderr.write(`computer-use-windows ${mode} listening on http://${config.host}:${config.port}\n`);
      resolve();
    });
  });
};

export const startTransport = async (config: ServerConfig, mode: TransportMode) => {
  if (mode === 'stdio') {
    await startStdio(config);
    return;
  }
  await startHttpServer(config, mode);
};
