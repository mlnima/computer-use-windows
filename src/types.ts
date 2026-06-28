import type { IPty } from '@lydell/node-pty';

export type Bounds = { bottom: number; left: number; right: number; top: number };
export type Point = { x: number; y: number };

export type MonitorInfo = {
  bounds: Bounds;
  id: string;
  isPrimary: boolean;
  name: string;
  workArea: Bounds;
};

export type WindowInfo = {
  bounds: Bounds;
  className: string;
  executablePath: string;
  handle: string;
  isForeground: boolean;
  isFullscreen: boolean;
  isMinimized: boolean;
  isOffscreen: boolean;
  processId: number;
  processName: string;
  title: string;
};

export type ScreenshotInfo = {
  bounds: Bounds;
  byteLength: number;
  coordinateSpace: 'screenshot';
  height: number;
  mimeType: 'image/png' | 'image/jpeg';
  resourceId: string;
  width: number;
  windowHandle: string;
};

export type AccessibilityNode = {
  automationId: string;
  bounds: Bounds;
  center: Point;
  className: string;
  enabled: boolean;
  focused: boolean;
  globalBounds: Bounds;
  globalCenter: Point;
  id: string;
  name: string;
  role: string;
  value: string;
};

export type Observation = {
  accessibilityPreview: AccessibilityNode[];
  accessibilityResourceIds: string[];
  capturedAt: string;
  consumed: boolean;
  cursor: Point | null;
  focusedWindow: WindowInfo | null;
  id: string;
  machineId: string;
  monitorResourceId: string;
  monitors: MonitorInfo[];
  screenshotResourceId: string;
  screenshotResourceIds: string[];
  screenshots: ScreenshotInfo[];
  securityPrompt: { detected: boolean; reason: string | null; windowHandle: string | null };
  selectedWindows: WindowInfo[];
  sessionId: string;
  stale: boolean;
  token: string;
  virtualDesktopBounds: Bounds;
  windowsResourceId: string;
};

export type ResourceRecord = {
  createdAt: string;
  id: string;
  mimeType: string;
  name: string;
  text?: string;
  bytes?: Buffer;
};

export type TerminalSession = {
  buffer: string;
  closed: boolean;
  createdAt: string;
  id: string;
  lastReadOffset: number;
  pty: IPty;
};
