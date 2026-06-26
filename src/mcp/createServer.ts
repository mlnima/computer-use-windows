import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig, TransportMode } from '../config';
import { packageName, packageVersion } from '../defaults';
import { createRuntimeState } from '../state';
import { registerPrompts } from './registerPrompts';
import { registerResources } from './registerResources';
import { registerTools } from './registerTools';

export const createComputerUseServer = (config: ServerConfig, transportMode: TransportMode) => {
  const state = createRuntimeState(transportMode);
  const server = new McpServer({ name: packageName, version: packageVersion });
  registerResources(server, state);
  registerPrompts(server);
  registerTools(server, state, config);
  return { server, state };
};
