import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../config';
import type { RuntimeState } from '../state';
import { registerAppTools } from './tools/appTools';
import { registerClipboardTools } from './tools/clipboardTools';
import { registerFileTools } from './tools/fileTools';
import { registerInputTools } from './tools/inputTools';
import { registerObservationTools } from './tools/observationTools';
import { registerTakeoverTools } from './tools/takeoverTools';
import { registerTerminalTools } from './tools/terminalTools';
import { registerTraceTools } from './tools/traceTools';

export const registerTools = (server: McpServer, state: RuntimeState, config: ServerConfig) => {
  registerObservationTools(server, state, config);
  registerInputTools(server, state, config);
  registerAppTools(server, state, config);
  registerTerminalTools(server, state, config);
  registerFileTools(server, state);
  registerClipboardTools(server, state, config);
  registerTakeoverTools(server, state, config);
  registerTraceTools(server, state, config);
};
