import type { Request, Response } from 'express';
import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js';
import type { ServerConfig } from '../config';
import { defaultAuth } from '../defaults';

const localOrigins = (host: string, port: number) => new Set([
  `http://${host}:${port}`,
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
]);

export const rejectUnauthorized = (req: Request, res: Response, token: string, host = '127.0.0.1') => {
  if (host === '0.0.0.0' && (!token || token === defaultAuth)) {
    res.status(401).json({ error: 'Set an auth token before binding to 0.0.0.0.' });
    return true;
  }
  if (!token || token === defaultAuth) return false;
  if (req.header('authorization') === `Bearer ${token}`) return false;
  res.status(401).json({ error: 'Missing or invalid bearer token.' });
  return true;
};

export const rejectOrigin = (req: Request, res: Response, host: string, port: number) => {
  const origin = req.header('origin');
  if (!origin || localOrigins(host, port).has(origin)) return false;
  res.status(403).json({ error: 'Origin is not allowed.' });
  return true;
};

export const rejectProtocolVersion = (req: Request, res: Response) => {
  const version = req.header('mcp-protocol-version');
  if (!version || SUPPORTED_PROTOCOL_VERSIONS.includes(version)) return false;
  res.status(400).json({ error: 'Unsupported MCP-Protocol-Version.' });
  return true;
};

export const mcpGuard = (config: ServerConfig, req: Request, res: Response) =>
  rejectOrigin(req, res, config.host, config.port)
  || rejectProtocolVersion(req, res)
  || rejectUnauthorized(req, res, config.auth, config.host);

export const sseGuard = (config: ServerConfig, req: Request, res: Response) =>
  rejectOrigin(req, res, config.host, config.port) || rejectUnauthorized(req, res, config.auth, config.host);
