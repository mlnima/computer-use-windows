import type { Express } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { ServerConfig } from '../config';
import { cleanupRuntimeState, type RuntimeState } from '../state';
import { createComputerUseServer } from './createServer';
import { sseGuard } from './httpGuards';

type SseSession = { state: RuntimeState; transport: SSEServerTransport };
const sessions = new Map<string, SseSession>();

export const registerSseRoutes = (app: Express, config: ServerConfig) => {
  app.get('/sse', async (req, res) => {
    if (sseGuard(config, req, res)) return;
    const { server, state } = createComputerUseServer(config, 'sse');
    const transport = new SSEServerTransport('/messages', res);
    sessions.set(transport.sessionId, { state, transport });
    transport.onclose = () => {
      cleanupRuntimeState(state);
      sessions.delete(transport.sessionId);
    };
    await server.connect(transport);
  });
  app.post('/messages', async (req, res) => {
    if (sseGuard(config, req, res)) return;
    const sessionId = String(req.query.sessionId || '');
    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Unknown SSE sessionId.' });
      return;
    }
    await session.transport.handlePostMessage(req, res, req.body);
  });
};
