import { randomUUID } from 'node:crypto';
import type { ServerConfig } from '../config';
import type { RuntimeState } from '../state';
import { addTextResource } from '../resources/store';
import { getAccessibility } from '../windows/accessibility';
import { listMonitors } from '../windows/monitors';
import { captureScreenshotResources } from '../windows/screenshot';
import { getCursorPosition, getForegroundWindow, listWindows } from '../windows/windows';

const detectSecurityPrompt = (windows: Awaited<ReturnType<typeof listWindows>>) => {
  const pattern = /captcha|mfa|password|credential|security|bank|payment|authenticator|verify/i;
  const match = windows.find((window) => pattern.test(`${window.title} ${window.processName}`));
  return {
    detected: Boolean(match),
    reason: match ? 'Human takeover is required for security, payment, credential, or verification prompts.' : null,
    windowHandle: match?.handle || null,
  };
};

const virtualBounds = (monitors: Awaited<ReturnType<typeof listMonitors>>) => ({
  bottom: Math.max(...monitors.map((monitor) => monitor.bounds.bottom), 0),
  left: Math.min(...monitors.map((monitor) => monitor.bounds.left), 0),
  right: Math.max(...monitors.map((monitor) => monitor.bounds.right), 0),
  top: Math.min(...monitors.map((monitor) => monitor.bounds.top), 0),
});

export const createObservation = async (
  state: RuntimeState,
  config: ServerConfig,
  params: { handles?: string[]; includeAccessibility?: boolean; inlineImage?: boolean } = {},
) => {
  const [monitors, windows, focusedWindow, cursor] = await Promise.all([
    listMonitors(),
    listWindows(),
    getForegroundWindow(),
    getCursorPosition().catch(() => null),
  ]);
  const windowsResourceId = addTextResource(state, 'windows.json', 'application/json', JSON.stringify(windows, null, 2), 'machines');
  const monitorResourceId = addTextResource(state, 'monitors.json', 'application/json', JSON.stringify(monitors, null, 2), 'machines');
  const handles = params.handles?.length ? params.handles : focusedWindow ? [focusedWindow.handle] : [];
  const selectedWindows = windows.filter((window) => handles.includes(window.handle));
  const screenshots = await captureScreenshotResources(state, config, selectedWindows, monitors);
  const screenshotResourceIds = screenshots.map((screenshot) => screenshot.resourceId);
  const accessibility = params.includeAccessibility === false ? [] : await Promise.all(handles.map(async (handle) => {
    const nodes = await getAccessibility(handle, config.accessibilityMaxNodes, screenshots.find((screenshot) => screenshot.windowHandle === handle));
    return {
      nodes,
      resourceId: addTextResource(state, `accessibility-${handle}.json`, 'application/json', JSON.stringify(nodes, null, 2), 'accessibility'),
    };
  }));
  const observation = {
    accessibilityPreview: accessibility.flatMap((entry) => entry.nodes.slice(0, 10)).slice(0, 30),
    accessibilityResourceIds: accessibility.map((entry) => entry.resourceId),
    capturedAt: new Date().toISOString(),
    consumed: false,
    cursor,
    focusedWindow,
    id: randomUUID(),
    machineId: state.machineId,
    monitorResourceId,
    monitors,
    screenshotResourceId: screenshotResourceIds[0] || '',
    screenshotResourceIds,
    screenshots,
    securityPrompt: detectSecurityPrompt(windows),
    selectedWindows,
    sessionId: state.sessionId,
    stale: false,
    token: randomUUID(),
    virtualDesktopBounds: virtualBounds(monitors),
    windowsResourceId,
  };
  state.latestObservation = observation;
  void params.inlineImage;
  return observation;
};
