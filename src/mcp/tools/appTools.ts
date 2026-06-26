import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../../config';
import type { RuntimeState } from '../../state';
import { assertCanMutate } from '../../state';
import { listApps, runApp, searchApps } from '../../apps/apps';
import { addTextResource } from '../../resources/store';
import { okResult, toolError } from '../toolResults';

const rules = (config: ServerConfig, blocklist?: string[]) =>
  [...config.blockedApps, ...(blocklist || [])];

export const registerAppTools = (server: McpServer, state: RuntimeState, config: ServerConfig) => {
  server.registerTool('search_apps', {
    description: 'Search installed Windows apps and games. Use this before list_apps.',
    inputSchema: { blocklist: z.array(z.string()).optional(), includeBuiltIn: z.boolean().optional(), limit: z.number().optional(), query: z.string() },
  }, async ({ blocklist, includeBuiltIn, limit = 20, query }) => okResult({
    apps: (await searchApps(query, rules(config, blocklist), includeBuiltIn)).slice(0, limit),
    machineId: state.machineId,
  }));
  server.registerTool('list_apps', {
    description: 'List installed Windows apps in bounded pages.',
    inputSchema: { blocklist: z.array(z.string()).optional(), cursor: z.number().optional(), includeBuiltIn: z.boolean().optional(), limit: z.number().optional() },
  }, async ({ blocklist, cursor = 0, includeBuiltIn, limit = 50 }) => {
    const apps = await listApps(rules(config, blocklist), includeBuiltIn);
    return okResult({
      apps: apps.slice(cursor, cursor + limit),
      catalogResourceId: addTextResource(state, 'apps.json', 'application/json', JSON.stringify(apps, null, 2), 'apps'),
      machineId: state.machineId,
      nextCursor: cursor + limit < apps.length ? cursor + limit : null,
      total: apps.length,
    });
  });
  server.registerTool('run_app', {
    description: 'Launch an allowed Windows app by appId or query.',
    inputSchema: {
      appId: z.string().optional(), args: z.array(z.string()).optional(), blocklist: z.array(z.string()).optional(), cwd: z.string().optional(), query: z.string().optional(),
    },
  }, async ({ appId, args, blocklist, cwd, query }) => {
    try {
      assertCanMutate(state);
      const apps = appId ? await listApps(rules(config, blocklist), true) : await searchApps(query || '', rules(config, blocklist), true);
      const app = appId ? apps.find((entry) => entry.id === appId) : apps[0];
      if (!app) throw new Error('No allowed app matched the request.');
      await runApp(app, args, cwd);
      return okResult({ app, machineId: state.machineId, summary: `Launched ${app.name}.` });
    } catch (error) {
      return toolError(error, 'Use search_apps() with includeBuiltIn when needed, then call run_app() with appId.');
    }
  });
};
