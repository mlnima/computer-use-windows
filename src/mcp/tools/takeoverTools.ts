import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../../config';
import type { RuntimeState } from '../../state';
import { appendLog } from '../../trace/trace';
import { createInputController } from '../../input/controller';
import { okResult } from '../toolResults';

export const registerTakeoverTools = (server: McpServer, state: RuntimeState, config: ServerConfig) => {
  server.registerTool('pause_session', { description: 'Pause new non-emergency actions.' }, async () => {
    state.paused = true;
    state.actionCancelled = true;
    await createInputController().releaseAll();
    appendLog(config, { tool: 'pause_session' });
    return okResult({ machineId: state.machineId, paused: true });
  });
  server.registerTool('resume_session', { description: 'Resume actions after pause or emergency.' }, async () => {
    state.paused = false;
    state.emergencyStopped = false;
    appendLog(config, { tool: 'resume_session' });
    return okResult({ emergencyStopped: false, machineId: state.machineId, paused: false });
  });
  server.registerTool('cancel_current_action', { description: 'Request cancellation of the current action.' }, async () => {
    const hadAction = state.currentActionId !== null;
    state.actionCancelled = true;
    await createInputController().releaseAll();
    appendLog(config, { hadAction, tool: 'cancel_current_action' });
    return okResult({ cancelled: hadAction, machineId: state.machineId });
  });
  server.registerTool('emergency_stop', { description: 'Release held input and stop further actions.' }, async () => {
    state.emergencyStopped = true;
    state.paused = true;
    state.actionCancelled = true;
    await createInputController().releaseAll();
    appendLog(config, { tool: 'emergency_stop' });
    return okResult({ emergencyStopped: true, machineId: state.machineId, paused: true });
  });
  server.registerTool('request_user_approval', {
    description: 'Record that human takeover or approval is required.',
    inputSchema: { action: z.string(), reason: z.string(), risk: z.string() },
  }, async ({ action, reason, risk }) => {
    appendLog(config, { action, reason, risk, tool: 'request_user_approval' });
    return okResult({ action, humanApprovalRequired: true, machineId: state.machineId, reason, risk });
  });
};
