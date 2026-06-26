import os from 'node:os';
import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../../config';
import type { RuntimeState } from '../../state';
import { assertCanMutate, setLastError } from '../../state';
import { getAccessibility, invokeAccessibility } from '../../windows/accessibility';
import { listMonitors } from '../../windows/monitors';
import { focusWindow, getWindowBounds, listWindows, moveWindow } from '../../windows/windows';
import { createInputController } from '../../input/controller';
import { createObservation } from '../../observation/observe';
import { addTextResource, readResourceByUri } from '../../resources/store';
import { okResult, textResult, toolError } from '../toolResults';

const observeResult = (state: RuntimeState, observation: Awaited<ReturnType<typeof createObservation>>, inline?: boolean) => {
  const result = { observation };
  const image = inline ? readResourceByUri(state, observation.screenshotResourceId) : null;
  return image?.bytes
    ? { content: [...textResult({ ok: true, ...result }).content, { type: 'image' as const, data: image.bytes.toString('base64'), mimeType: image.mimeType }] }
    : okResult(result);
};

export const registerObservationTools = (server: McpServer, state: RuntimeState, config: ServerConfig) => {
  server.registerTool('computer_status', { description: 'Return machine, transport, runtime, input driver, pause, emergency, clipboard, monitor, and last error state.' }, async () => {
    const monitors = await listMonitors().catch(() => []);
    return okResult({
      driver: createInputController().driverStatus(),
      emergencyStopped: state.emergencyStopped,
      endpoints: { mcp: `http://${config.httpHost}:${config.httpPort}/mcp`, sse: `http://${config.sseHost}:${config.ssePort}/sse` },
      hostname: os.hostname(),
      lastError: state.lastError,
      machineId: state.machineId,
      monitors,
      paused: state.paused,
      preservedClipboard: state.preservedClipboard !== null,
      resourceCount: state.resources.size,
      runtimeDir: config.runtimeDir,
      sessionId: state.sessionId,
      terminalCount: state.terminals.size,
      transport: state.transportMode,
      username: os.userInfo().username,
    });
  });
  server.registerTool('computer_observe', { description: 'Capture screenshot, windows, monitors, cursor, and accessibility resources.', inputSchema: {
    handles: z.array(z.string()).optional(), includeAccessibility: z.boolean().optional(), includeMonitors: z.boolean().optional(), includeWindows: z.boolean().optional(), inlineImage: z.boolean().optional(), target: z.unknown().optional(),
  } }, async (args) => {
    try { return observeResult(state, await createObservation(state, config, args), args.inlineImage); } catch (error) { setLastError(state, error); return toolError(error); }
  });
  server.registerTool('list_monitors', { description: 'List Windows monitors.' }, async () => okResult({ monitors: await listMonitors() }));
  server.registerTool('list_windows', { description: 'List visible top-level Windows app windows.', inputSchema: { limit: z.number().optional(), cursor: z.number().optional() } }, async ({ limit = 100, cursor = 0 }) => {
    const windows = await listWindows();
    return okResult({ nextCursor: cursor + limit < windows.length ? cursor + limit : null, windows: windows.slice(cursor, cursor + limit) });
  });
  server.registerTool('focus_window', { description: 'Focus a window by handle.', inputSchema: { handle: z.string() } }, async ({ handle }) => {
    try { assertCanMutate(state); await focusWindow(handle); return okResult({ handle, machineId: state.machineId }); } catch (error) { setLastError(state, error); return toolError(error); }
  });
  server.registerTool('move_window', { description: 'Move and optionally resize a window.', inputSchema: { handle: z.string(), height: z.number().optional(), monitorId: z.string().optional(), width: z.number().optional(), x: z.number(), y: z.number() } }, async ({ handle, height, width, x, y }) => {
    assertCanMutate(state);
    const current = await getWindowBounds(handle); const w = width || Math.max(1, (current?.right || x + 800) - (current?.left || x));
    const h = height || Math.max(1, (current?.bottom || y + 600) - (current?.top || y));
    await moveWindow(handle, { bottom: y + h, left: x, right: x + w, top: y }); return okResult({ handle, machineId: state.machineId });
  });
  server.registerTool('resize_window', { description: 'Resize a window without changing its top-left point.', inputSchema: { handle: z.string(), height: z.number(), width: z.number() } }, async ({ handle, height, width }) => {
    assertCanMutate(state);
    const current = await getWindowBounds(handle); if (!current) throw new Error('Window bounds unavailable.');
    await moveWindow(handle, { bottom: current.top + height, left: current.left, right: current.left + width, top: current.top }); return okResult({ handle, machineId: state.machineId });
  });
  server.registerTool('observe_windows', { description: 'Observe multiple windows and return accessibility resource ids.', inputSchema: { handles: z.array(z.string()), includeAccessibility: z.boolean().optional(), inlineImages: z.boolean().optional() } }, async ({ handles, includeAccessibility, inlineImages }) =>
    observeResult(state, await createObservation(state, config, { handles, includeAccessibility, inlineImage: inlineImages }), inlineImages));
  server.registerTool('get_window_accessibility', { description: 'Read a window accessibility tree as a resource.', inputSchema: { handle: z.string(), maxNodes: z.number().optional() } }, async ({ handle, maxNodes }) => {
    const nodes = await getAccessibility(handle, maxNodes || config.accessibilityMaxNodes);
    return okResult({
      machineId: state.machineId,
      resourceId: addTextResource(state, `accessibility-${handle}.json`, 'application/json', JSON.stringify(nodes, null, 2), 'accessibility'),
    });
  });
  server.registerTool('invoke_accessibility_action', { description: 'Invoke a Windows UI Automation action on a node.', inputSchema: { action: z.string(), nodeId: z.string(), value: z.string().optional(), windowHandle: z.string() } }, async ({ action, nodeId, value, windowHandle }) => {
    assertCanMutate(state);
    await invokeAccessibility(windowHandle, nodeId, action, value); return okResult({ action, machineId: state.machineId, nodeId });
  });
  server.registerTool('calibrate_coordinates', {
    description: 'Return monitor, cursor, and optional window geometry for reliable screen coordinates.',
    inputSchema: { handle: z.string().optional(), monitorId: z.string().optional() },
  }, async ({ handle, monitorId }) => {
    const [monitors, windows] = await Promise.all([listMonitors(), listWindows()]);
    const monitor = monitorId ? monitors.find((entry) => entry.id === monitorId) || null : null;
    const window = handle ? windows.find((entry) => entry.handle === handle) || null : null;
    const virtualDesktopBounds = {
      bottom: Math.max(...monitors.map((entry) => entry.bounds.bottom), 0),
      left: Math.min(...monitors.map((entry) => entry.bounds.left), 0),
      right: Math.max(...monitors.map((entry) => entry.bounds.right), 0),
      top: Math.min(...monitors.map((entry) => entry.bounds.top), 0),
    };
    return okResult({ machineId: state.machineId, monitor, monitors, virtualDesktopBounds, window });
  });
};
