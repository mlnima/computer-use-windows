import fs from 'node:fs';
import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../../config';
import type { RuntimeState } from '../../state';
import { exportTrace, listLogFiles, searchLogs } from '../../trace/trace';
import { addTextResource } from '../../resources/store';
import { okResult, toolError } from '../toolResults';

export const registerTraceTools = (server: McpServer, state: RuntimeState, config: ServerConfig) => {
  server.registerTool('export_trace', { description: 'Export current trace data as a resource.' }, async () =>
    okResult({ machineId: state.machineId, resourceId: exportTrace(state, config) }));
  server.registerTool('replay_trace', { description: 'Replay trace records without running actions.' }, async () => okResult({
    machineId: state.machineId,
    replayResourceId: addTextResource(state, 'trace-replay.json', 'application/json', JSON.stringify(state.lastActions, null, 2), 'traces'),
  }));
  server.registerTool('get_last_actions', {
    description: 'Return recent action records.',
    inputSchema: { count: z.number() },
  }, async ({ count }) => okResult({ actions: state.lastActions.slice(0, count), machineId: state.machineId }));
  server.registerTool('list_logs', {
    description: 'List MCP log files.',
    inputSchema: { cursor: z.number().optional(), limit: z.number().optional(), sessionId: z.string().optional(), traceId: z.string().optional(), level: z.string().optional() },
  }, async ({ cursor = 0, limit = 20 }) => {
    const logs = listLogFiles(config);
    return okResult({ logs: logs.slice(cursor, cursor + limit), machineId: state.machineId, nextCursor: cursor + limit < logs.length ? cursor + limit : null });
  });
  server.registerTool('read_log', {
    description: 'Read one bounded log file.',
    inputSchema: { logId: z.string(), maxBytes: z.number().optional() },
  }, async ({ logId, maxBytes = 64 * 1024 }) => {
    const log = listLogFiles(config).find((entry) => entry.id === logId);
    if (!log) return toolError(new Error('Log not found.'), 'Call list_logs() and retry with a returned logId.');
    const text = fs.readFileSync(log.path, 'utf8');
    return okResult({
      logId,
      machineId: state.machineId,
      resourceId: text.length > maxBytes ? addTextResource(state, logId, 'application/json', text, 'logs') : null,
      text: text.slice(0, maxBytes),
      truncated: text.length > maxBytes,
    });
  });
  server.registerTool('search_logs', {
    description: 'Search MCP logs.',
    inputSchema: { from: z.string().optional(), level: z.string().optional(), limit: z.number().optional(), query: z.string().optional(), sessionId: z.string().optional(), to: z.string().optional(), traceId: z.string().optional() },
  }, async ({ limit = 100, query }) => okResult({ machineId: state.machineId, matches: searchLogs(config, query).slice(0, limit) }));
};
