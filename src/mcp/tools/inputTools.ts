import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../../config';
import type { RuntimeState } from '../../state';
import { setLastError } from '../../state';
import { runComputerAction } from '../../input/actions';
import { okResult, toolError } from '../toolResults';

export const registerInputTools = (server: McpServer, state: RuntimeState, config: ServerConfig) => {
  server.registerTool('computer_act', {
    description: 'Run one native mouse or keyboard action using a fresh observation token.',
    inputSchema: {
      action: z.object({ kind: z.string() }).catchall(z.unknown()),
      observationToken: z.string().optional(),
    },
  }, async ({ action, observationToken }) => {
    try {
      const result = await runComputerAction(state, config, observationToken, action);
      const resourceIds = [
        result.followUpObservation.screenshotResourceId,
        result.followUpObservation.windowsResourceId,
        result.followUpObservation.monitorResourceId,
        ...result.followUpObservation.accessibilityResourceIds,
      ];
      return okResult({
        ...result,
        next: 'Use followUpObservation.token for the next screen-coordinate action.',
        resourceIds,
        summary: `Completed ${action.kind}.`,
      });
    } catch (error) {
      setLastError(state, error);
      return toolError(error, 'Call computer_observe() and retry with a fresh observation token.');
    }
  });
};
