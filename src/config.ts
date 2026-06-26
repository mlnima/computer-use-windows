import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  accessibilityMaxNodes,
  defaultAuth,
  defaultForceStopHotkey,
  defaultHost,
  defaultPort,
  defaultRuntimeDir,
  screenshotMaxBytes,
  screenshotMaxSide,
} from './defaults';

export type TransportMode = 'all' | 'mcp' | 'sse' | 'stdio';

export type ServerConfig = {
  auth: string;
  host: string;
  port: number;
  runtimeDir: string;
  blockedApps: string[];
  forceStopHotkey: string;
  disableForceStopHotkey: boolean;
  screenshotMaxBytes: number;
  screenshotMaxSide: number;
  accessibilityMaxNodes: number;
};

const envPrefix = 'COMPUTER_USE_WINDOWS_';
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const envFilePath = path.join(moduleDir, '..', '.env');
const hasEnvFile = fs.existsSync(envFilePath);

const parseEnvFile = () => {
  if (!fs.existsSync(envFilePath)) return {};
  const values: Record<string, string> = {};
  for (const line of fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    const index = trimmed.indexOf('=');
    const key = index > 0 ? trimmed.slice(0, index).trim() : '';
    if (!key.startsWith(envPrefix)) continue;
    const value = trimmed.slice(index + 1).trim();
    const quote = value[0];
    values[key] = (quote === '"' || quote === "'") && value.endsWith(quote)
      ? value.slice(1, -1)
      : value;
  }
  return values;
};

const envFile = parseEnvFile();

const envString = (key: string) =>
  hasEnvFile ? envFile[key]?.trim() || '' : process.env[key]?.trim() || '';

const envBoolean = (key: string) =>
  ['1', 'true', 'yes'].includes(envString(key).toLowerCase());

const envNumber = (key: string, fallback: number) => {
  const value = Number(envString(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const splitComma = (value: string) =>
  value.split(',').map((entry) => entry.trim()).filter(Boolean);

export const loadConfig = (): ServerConfig => ({
  auth: envString('COMPUTER_USE_WINDOWS_AUTH') || defaultAuth,
  host: envString('COMPUTER_USE_WINDOWS_HOST') || defaultHost,
  port: envNumber('COMPUTER_USE_WINDOWS_PORT', defaultPort),
  runtimeDir: path.resolve(envString('COMPUTER_USE_WINDOWS_LOG_DIR') || defaultRuntimeDir()),
  blockedApps: splitComma(envString('COMPUTER_USE_WINDOWS_BLOCKED_APPS')),
  forceStopHotkey: envString('COMPUTER_USE_WINDOWS_FORCE_STOP_HOTKEY') || defaultForceStopHotkey,
  disableForceStopHotkey: envBoolean('COMPUTER_USE_WINDOWS_DISABLE_FORCE_STOP_HOTKEY'),
  screenshotMaxBytes: envNumber('COMPUTER_USE_WINDOWS_SCREENSHOT_MAX_BYTES', screenshotMaxBytes),
  screenshotMaxSide: envNumber('COMPUTER_USE_WINDOWS_SCREENSHOT_MAX_SIDE', screenshotMaxSide),
  accessibilityMaxNodes: envNumber('COMPUTER_USE_WINDOWS_ACCESSIBILITY_MAX_NODES', accessibilityMaxNodes),
});
