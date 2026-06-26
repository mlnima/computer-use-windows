import os from 'node:os';
import path from 'node:path';

export const packageName = 'computer-use-windows';
export const packageVersion = '0.1.0';
export const defaultHost = '127.0.0.1';
export const defaultHttpPort = 7332;
export const defaultSsePort = 7333;
export const defaultAuth = 'change.me';
export const defaultForceStopHotkey = 'Control+F12';
export const screenshotMaxBytes = 5 * 1024 * 1024;
export const screenshotMaxSide = 2000;
export const accessibilityMaxNodes = 160;
export const maxInlineTextBytes = 64 * 1024;

export const defaultRuntimeDir = () =>
  path.join(os.homedir(), '.computer-use-windows');
