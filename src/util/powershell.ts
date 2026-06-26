import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const maxBuffer = 64 * 1024 * 1024;

export const runPowerShell = async (script: string) => {
  if (process.platform !== 'win32') throw new Error('computer-use-windows requires Windows.');
  const wrapped = [
    '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)',
    '$OutputEncoding = [Console]::OutputEncoding',
    script,
  ].join('\n');
  const encoded = Buffer.from(wrapped, 'utf16le').toString('base64');
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-EncodedCommand', encoded],
    { maxBuffer, windowsHide: true },
  );
  return stdout.trim();
};

export const runPowerShellJson = async <T>(script: string, fallback: T): Promise<T> => {
  const output = await runPowerShell(script);
  return output.length > 0 ? JSON.parse(output) as T : fallback;
};

export const psString = (value: string) =>
  value.replace(/'/g, "''");
