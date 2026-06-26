import fs from 'node:fs';
import path from 'node:path';
import { runPowerShell } from '../util/powershell';

export const fileExists = (filePath: string) =>
  fs.existsSync(path.resolve(filePath));

export const readTextFile = (filePath: string, maxBytes = 64 * 1024) => {
  const resolved = path.resolve(filePath);
  const buffer = fs.readFileSync(resolved);
  return {
    byteLength: buffer.byteLength,
    text: buffer.subarray(0, maxBytes).toString('utf8'),
    truncated: buffer.byteLength > maxBytes,
  };
};

export const writeFile = (filePath: string, content: string) => {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content);
  return resolved;
};

export const listDirectory = (dirPath: string, limit = 100, cursor = 0) => {
  const resolved = path.resolve(dirPath);
  const entries = fs.readdirSync(resolved, { withFileTypes: true });
  return {
    entries: entries.slice(cursor, cursor + limit).map((entry) => ({
      isDirectory: entry.isDirectory(),
      name: entry.name,
      path: path.join(resolved, entry.name),
    })),
    nextCursor: cursor + limit < entries.length ? cursor + limit : null,
    total: entries.length,
  };
};

export const revealInExplorer = async (targetPath: string) => {
  await runPowerShell(`explorer.exe /select,"${path.resolve(targetPath).replace(/"/g, '""')}"`);
};
