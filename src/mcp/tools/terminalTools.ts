import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../../config';
import type { RuntimeState } from '../../state';
import { assertCanMutate } from '../../state';
import { closeTerminal, openTerminal, readTerminal, resizeTerminal, writeTerminal } from '../../terminal/terminal';
import { appendLog } from '../../trace/trace';
import { addTextResource } from '../../resources/store';
import { okResult, toolError } from '../toolResults';

export const registerTerminalTools = (server: McpServer, state: RuntimeState, config: ServerConfig) => {
  server.registerTool('terminal_open', {
    description: 'Open a real terminal using @lydell/node-pty.',
    inputSchema: { cols: z.number().optional(), cwd: z.string().optional(), env: z.record(z.string(), z.unknown()).optional(), rows: z.number().optional(), shell: z.string().optional() },
  }, async ({ cols, cwd, env, rows, shell }) => {
    assertCanMutate(state);
    const session = openTerminal(state, shell, cwd, cols, rows, env);
    appendLog(config, { terminalId: session.id, tool: 'terminal_open' });
    return okResult({ machineId: state.machineId, terminalId: session.id });
  });
  server.registerTool('terminal_write', {
    description: 'Write text to an open pty terminal.',
    inputSchema: { terminalId: z.string(), text: z.string() },
  }, async ({ terminalId, text }) => {
    try {
      assertCanMutate(state);
      writeTerminal(state, terminalId, text);
      appendLog(config, { bytes: text.length, terminalId, tool: 'terminal_write' });
      return okResult({ machineId: state.machineId, terminalId, writtenBytes: text.length });
    } catch (error) { return toolError(error, 'Call terminal_read() to inspect state or terminal_close() to clean up.'); }
  });
  server.registerTool('terminal_read', {
    description: 'Read bounded output from a pty terminal.',
    inputSchema: { maxBytes: z.number().optional(), terminalId: z.string() },
  }, async ({ maxBytes, terminalId }) => {
    const result = readTerminal(state, terminalId, maxBytes);
    const { resourceText, ...compact } = result;
    appendLog(config, { bytes: resourceText.length, terminalId, tool: 'terminal_read' });
    return okResult({
      ...compact,
      machineId: state.machineId,
      resourceId: result.truncated ? addTextResource(state, `terminal-${terminalId}.txt`, 'text/plain', resourceText, `terminal/${terminalId}`) : null,
    });
  });
  server.registerTool('terminal_resize', {
    description: 'Resize a pty terminal.',
    inputSchema: { cols: z.number(), rows: z.number(), terminalId: z.string() },
  }, async ({ cols, rows, terminalId }) => { resizeTerminal(state, terminalId, cols, rows); return okResult({ cols, machineId: state.machineId, rows, terminalId }); });
  server.registerTool('terminal_interrupt', {
    description: 'Send Ctrl+C to a pty terminal.',
    inputSchema: { terminalId: z.string() },
  }, async ({ terminalId }) => { writeTerminal(state, terminalId, '\x03'); return okResult({ machineId: state.machineId, terminalId }); });
  server.registerTool('terminal_close', {
    description: 'Close a pty terminal.',
    inputSchema: { terminalId: z.string() },
  }, async ({ terminalId }) => okResult({ closed: closeTerminal(state, terminalId), machineId: state.machineId, terminalId }));
};
