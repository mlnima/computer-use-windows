import os from 'node:os';
import path from 'node:path';

export const packageName = 'computer-use-windows';
export const packageVersion = '0.1.0';
export const defaultHost = '127.0.0.1';
export const defaultPort = 7332;
export const defaultAuth = 'change.me';
export const defaultForceStopHotkey = 'Control+F12';
export const screenshotMaxBytes = 5 * 1024 * 1024;
export const screenshotMaxSide = 2000;
export const accessibilityMaxNodes = 160;
export const maxInlineTextBytes = 64 * 1024;

const windowsUsername = () =>
  os.userInfo().username || process.env.USERNAME || 'Default';

const windowsDriveRoot = () => {
  const windowsRoot = process.env.SystemRoot || process.env.windir || '';
  const systemDrive = process.env.SystemDrive || '';
  return path.parse(windowsRoot).root || (systemDrive ? `${systemDrive}\\` : 'C:\\');
};

const userHomeDir = () =>
  process.platform === 'win32'
    ? path.join(windowsDriveRoot(), 'Users', windowsUsername())
    : os.homedir();

export const defaultRuntimeDir = () =>
  path.join(userHomeDir(), '.computer-use-windows');

export const defaultLogDir = () =>
  path.join(defaultRuntimeDir(), 'logs');

export const defaultScreenshotsDir = () =>
  path.join(defaultRuntimeDir(), 'screenshots');
