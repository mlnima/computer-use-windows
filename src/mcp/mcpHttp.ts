import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { ServerConfig } from '../config';
import { cleanupRuntimeState, type RuntimeState } from '../state';
import { createComputerUseServer } from './createServer';
import { createEventStore } from './eventStore';
import { mcpGuard } from './httpGuards';

type McpSession = { state: RuntimeState; transport: StreamableHTTPServerTransport };

const sessions = new Map<string, McpSession>();

const closeSession = async (sessionId: string) => {
  const session = sessions.get(sessionId);
  if (!session) return;
  cleanupRuntimeState(session.state);
  sessions.delete(sessionId);
};

const makeTransport = async (config: ServerConfig) => {
  const { server, state } = createComputerUseServer(config, 'mcp');
  let transport: StreamableHTTPServerTransport;
  transport = new StreamableHTTPServerTransport({
    eventStore: createEventStore(),
    onsessionclosed: closeSession,
    onsessioninitialized: (sessionId): void => { sessions.set(sessionId, { state, transport }); },
    sessionIdGenerator: randomUUID,
  });
  await server.connect(transport);
  return transport;
};

const existingTransport = (req: Request, res: Response) => {
  const sessionId = req.header('mcp-session-id');
  const session = sessionId ? sessions.get(sessionId) : null;
  if (!sessionId) res.status(400).json({ error: 'Missing Mcp-Session-Id.' });
  else if (!session) res.status(404).json({ error: 'Unknown Mcp-Session-Id.' });
  return session?.transport || null;
};

export const registerMcpHttpRoutes = (app: Express, config: ServerConfig) => {
  app.post('/mcp', async (req, res) => {
    if (mcpGuard(config, req, res)) return;
    const sessionId = req.header('mcp-session-id');
    const transport = sessionId
      ? sessions.get(sessionId)?.transport
      : isInitializeRequest(req.body) ? await makeTransport(config) : null;
    if (!transport) {
      res.status(sessionId ? 404 : 400).json({ error: sessionId ? 'Unknown Mcp-Session-Id.' : 'Initialization required.' });
      return;
    }
    await transport.handleRequest(req, res, req.body);
  });
  app.get('/mcp', async (req, res) => {
    if (mcpGuard(config, req, res)) return;
    const transport = existingTransport(req, res);
    if (transport) await transport.handleRequest(req, res);
  });
  app.delete('/mcp', async (req, res) => {
    if (mcpGuard(config, req, res)) return;
    const transport = existingTransport(req, res);
    if (transport) await transport.handleRequest(req, res);
  });
};
