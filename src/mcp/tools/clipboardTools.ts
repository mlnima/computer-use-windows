import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import type { ServerConfig } from '../../config';
import type { RuntimeState } from '../../state';
import { assertCanMutate } from '../../state';
import { clearClipboard, getClipboardText, setClipboardText } from '../../windows/clipboard';
import { appendLog } from '../../trace/trace';
import { okResult, toolError } from '../toolResults';

const logClipboard = (config: ServerConfig, tool: string, bytes?: number) =>
  appendLog(config, { bytes, clipboard: '[redacted]', tool });

export const registerClipboardTools = (server: McpServer, state: RuntimeState, config: ServerConfig) => {
  server.registerTool('get_clipboard_text', { description: 'Read current clipboard text.' }, async () => {
    const text = await getClipboardText();
    logClipboard(config, 'get_clipboard_text', text.length);
    return okResult({ machineId: state.machineId, text });
  });
  server.registerTool('set_clipboard_text', {
    description: 'Set clipboard text.',
    inputSchema: { text: z.string() },
  }, async ({ text }) => {
    assertCanMutate(state);
    await setClipboardText(text);
    logClipboard(config, 'set_clipboard_text', text.length);
    return okResult({ machineId: state.machineId, writtenBytes: text.length });
  });
  server.registerTool('clear_clipboard', { description: 'Clear clipboard text.' }, async () => {
    assertCanMutate(state);
    await clearClipboard();
    logClipboard(config, 'clear_clipboard');
    return okResult({ machineId: state.machineId });
  });
  server.registerTool('preserve_clipboard_begin', { description: 'Preserve clipboard text for this MCP session.' }, async () => {
    state.preservedClipboard = await getClipboardText();
    logClipboard(config, 'preserve_clipboard_begin', state.preservedClipboard.length);
    return okResult({ machineId: state.machineId, preserved: true });
  });
  server.registerTool('preserve_clipboard_end', { description: 'Restore preserved clipboard text for this MCP session.' }, async () => {
    try {
      if (state.preservedClipboard === null) throw new Error('No preserved clipboard value exists.');
      assertCanMutate(state);
      await setClipboardText(state.preservedClipboard);
      state.preservedClipboard = null;
      logClipboard(config, 'preserve_clipboard_end');
      return okResult({ machineId: state.machineId, restored: true });
    } catch (error) { return toolError(error, 'Call preserve_clipboard_begin() before actions that need clipboard restore.'); }
  });
};
