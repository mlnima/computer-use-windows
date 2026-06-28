import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../../config';
import type { RuntimeState } from '../../state';
import { setLastError } from '../../state';
import { runComputerAction } from '../../input/actions';
import { okResult, toolError } from '../toolResults';

const actionSchema = z.object({ kind: z.string() }).catchall(z.unknown());
const verificationSchema = z.object({}).catchall(z.unknown());

const actionResourceIds = (result: Awaited<ReturnType<typeof runComputerAction>>) => [
  ...result.followUpObservation.screenshotResourceIds,
  result.followUpObservation.windowsResourceId,
  result.followUpObservation.monitorResourceId,
  ...result.followUpObservation.accessibilityResourceIds,
];

const assertVerificationObject = (verification: Record<string, unknown>, index: number) => {
  if (Object.keys(verification).length > 0) return;
  throw new Error(`computer_act_sequence step ${index + 1} requires a non-empty verification object.`);
};

export const registerInputTools = (server: McpServer, state: RuntimeState, config: ServerConfig) => {
  server.registerTool('computer_act', {
    description: 'Run one native mouse or keyboard action against a target window using a fresh observation token. Prefer this over sequences and verify the follow-up state before the next action.',
    inputSchema: {
      action: actionSchema,
      observationToken: z.string(),
      verification: verificationSchema.optional(),
    },
  }, async ({ action, observationToken, verification }) => {
    try {
      const result = await runComputerAction(state, config, observationToken, action, verification);
      return okResult({
        ...result,
        next: 'Inspect followUpObservation or pass verification before the next action.',
        resourceIds: actionResourceIds(result),
        summary: `Completed ${action.kind}.`,
      });
    } catch (error) {
      setLastError(state, error);
      return toolError(error, 'Call computer_observe() and retry with a fresh observation token.');
    }
  });
  server.registerTool('computer_act_sequence', {
    description: 'Rare-use sequence runner. Runs multiple actions only when every step has verification; stops on the first mismatch.',
    inputSchema: {
      observationToken: z.string(),
      steps: z.array(z.object({ action: actionSchema, verification: verificationSchema })).min(1).max(20),
    },
  }, async ({ observationToken, steps }) => {
    try {
      let token = observationToken;
      let lastResult: Awaited<ReturnType<typeof runComputerAction>> | null = null;
      const completed = [];
      for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index]!;
        assertVerificationObject(step.verification, index);
        lastResult = await runComputerAction(state, config, token, step.action, step.verification);
        token = lastResult.followUpObservation.token;
        completed.push({ actionId: lastResult.actionId, index, kind: String(step.action.kind), verification: lastResult.verification });
      }
      return okResult({
        completed,
        followUpObservation: lastResult?.followUpObservation || null,
        machineId: state.machineId,
        next: 'Inspect the final followUpObservation before any further action.',
        resourceIds: lastResult ? actionResourceIds(lastResult) : [],
      });
    } catch (error) {
      setLastError(state, error);
      return toolError(error, 'Sequence stopped. Call computer_observe() and inspect the target before retrying.');
    }
  });
};
