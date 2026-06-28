import fs from 'node:fs';
import path from 'node:path';
import type { ServerConfig } from '../config';
import type { RuntimeState } from '../state';
import { addTextResource } from '../resources/store';

const runtimeDirs = ['traces', 'terminal', 'resources', 'clipboard'];

const runtimeChildPath = (config: ServerConfig, target: string) => {
  const runtime = path.resolve(config.runtimeDir);
  const resolved = path.resolve(target);
  const relative = path.relative(runtime, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to manage runtime path outside ${runtime}: ${resolved}`);
  }
  return resolved;
};

const resetDir = (dir: string) => {
  fs.rmSync(dir, { force: true, recursive: true });
  fs.mkdirSync(dir, { recursive: true });
};

export const ensureTraceDirs = (config: ServerConfig) => {
  fs.mkdirSync(config.logDir, { recursive: true });
  fs.mkdirSync(config.screenshotsDir, { recursive: true });
  for (const dir of runtimeDirs) {
    fs.mkdirSync(path.join(config.runtimeDir, dir), { recursive: true });
  }
};

export const prepareRuntimeDirs = (config: ServerConfig) => {
  resetDir(runtimeChildPath(config, config.screenshotsDir));
  for (const dir of runtimeDirs) {
    resetDir(runtimeChildPath(config, path.join(config.runtimeDir, dir)));
  }
  ensureTraceDirs(config);
};

const logPath = (config: ServerConfig) =>
  path.join(config.logDir, `${new Date().toISOString().slice(0, 10)}.jsonl`);

const redact = (value: string) =>
  value
    .replace(/(password|token|secret|key)["':=\s]+[^\s"',}]+/gi, '$1=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/g, 'Bearer [redacted]');

export const appendLog = (config: ServerConfig, entry: Record<string, unknown>) => {
  ensureTraceDirs(config);
  fs.appendFileSync(logPath(config), `${redact(JSON.stringify({
    at: new Date().toISOString(),
    ...entry,
  }))}\n`);
};

export const listLogFiles = (config: ServerConfig) => {
  ensureTraceDirs(config);
  return fs.readdirSync(config.logDir)
    .filter((entry) => entry.endsWith('.jsonl'))
    .sort()
    .reverse()
    .map((entry) => ({ id: entry, path: path.join(config.logDir, entry) }));
};

export const exportTrace = (state: RuntimeState, config: ServerConfig) => {
  const logs = listLogFiles(config).slice(0, 20).map((entry) => ({
    id: entry.id,
    text: fs.readFileSync(entry.path, 'utf8'),
  }));
  return addTextResource(state, 'trace-export.json', 'application/json', JSON.stringify({
    machineId: state.machineId,
    sessionId: state.sessionId,
    actions: state.lastActions,
    logs,
  }, null, 2), 'traces');
};

export const searchLogs = (config: ServerConfig, query = '') => {
  const lower = query.toLowerCase();
  return listLogFiles(config).flatMap((file) =>
    fs.readFileSync(file.path, 'utf8').split(/\r?\n/)
      .filter((line) => line && (!lower || line.toLowerCase().includes(lower)))
      .slice(0, 100)
      .map((line) => ({ logId: file.id, line })),
  );
};
