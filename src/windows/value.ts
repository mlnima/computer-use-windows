import type { Bounds, MonitorInfo, Point, WindowInfo } from '../types';

const numberValue = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;

export const toBounds = (value: unknown): Bounds => {
  const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    bottom: numberValue(item.bottom),
    left: numberValue(item.left),
    right: numberValue(item.right),
    top: numberValue(item.top),
  };
};

export const toPoint = (value: unknown): Point => {
  const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { x: numberValue(item.x), y: numberValue(item.y) };
};

export const toMonitor = (value: Record<string, unknown>): MonitorInfo => ({
  bounds: toBounds(value.bounds),
  id: String(value.id || ''),
  isPrimary: value.isPrimary === true,
  name: String(value.name || ''),
  workArea: toBounds(value.workArea),
});

export const toWindow = (value: Record<string, unknown>): WindowInfo => ({
  bounds: toBounds(value.bounds),
  className: String(value.className || ''),
  executablePath: String(value.executablePath || ''),
  handle: String(value.handle || ''),
  isForeground: value.isForeground === true,
  isFullscreen: value.isFullscreen === true,
  isMinimized: value.isMinimized === true,
  isOffscreen: value.isOffscreen === true,
  processId: numberValue(value.processId),
  processName: String(value.processName || ''),
  title: String(value.title || ''),
});

export const normalizeArray = <T>(value: T | T[] | null): T[] =>
  Array.isArray(value) ? value : value ? [value] : [];
