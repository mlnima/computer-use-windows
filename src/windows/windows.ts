import type { Bounds, WindowInfo } from '../types';
import { psString, runPowerShell, runPowerShellJson } from '../util/powershell';
import { winApiSource } from './desktopScripts';
import { normalizeArray, toBounds, toWindow } from './value';
import { listMonitors } from './monitors';

const overlaps = (a: Bounds, b: Bounds) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const covers = (window: Bounds, monitor: Bounds) =>
  window.left <= monitor.left && window.top <= monitor.top
  && window.right >= monitor.right && window.bottom >= monitor.bottom;

const addWindowState = async (windows: WindowInfo[]) => {
  const monitors = await listMonitors().catch(() => []);
  return windows.map((window) => ({
    ...window,
    isFullscreen: monitors.some((monitor) => covers(window.bounds, monitor.bounds)),
    isOffscreen: !monitors.some((monitor) => overlaps(window.bounds, monitor.bounds)),
  }));
};

export const listWindows = async (): Promise<WindowInfo[]> => {
  const raw = await runPowerShellJson<Record<string, unknown> | Record<string, unknown>[]>(`
Add-Type -MemberDefinition '${psString(winApiSource)}' -Name WinApi -Namespace Native
[Native.WinApi]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null
$fg=[Native.WinApi]::GetForegroundWindow()
Get-Process | Where-Object {$_.MainWindowHandle -ne 0 -and $_.MainWindowTitle} | ForEach-Object {
$r=New-Object Native.WinApi+RECT; [Native.WinApi]::GetWindowRect($_.MainWindowHandle,[ref]$r)|Out-Null
[PSCustomObject]@{handle=$_.MainWindowHandle.ToInt64().ToString();title=$_.MainWindowTitle;processId=$_.Id;processName=$_.ProcessName;executablePath=$_.Path;className='';isForeground=($_.MainWindowHandle -eq $fg);isMinimized=[Native.WinApi]::IsIconic($_.MainWindowHandle);bounds=[PSCustomObject]@{left=$r.Left;top=$r.Top;right=$r.Right;bottom=$r.Bottom}}
} | ConvertTo-Json -Depth 6 -Compress`, []);
  return await addWindowState(normalizeArray(raw).map(toWindow).filter((entry) => entry.handle && entry.title));
};

export const getForegroundWindow = async () =>
  (await listWindows()).find((entry) => entry.isForeground) || null;

export const focusWindow = async (handle: string) => {
  await runPowerShell(`
Add-Type -MemberDefinition '${psString(winApiSource)}' -Name WinApi -Namespace Native
$h=[IntPtr]([Int64]'${psString(handle)}')
[Native.WinApi]::ShowWindowAsync($h,9)|Out-Null
[Native.WinApi]::SetForegroundWindow($h)|Out-Null`);
};

export const moveWindow = async (handle: string, bounds: Bounds) => {
  const width = Math.max(1, Math.round(bounds.right - bounds.left));
  const height = Math.max(1, Math.round(bounds.bottom - bounds.top));
  await runPowerShell(`
Add-Type -MemberDefinition '${psString(winApiSource)}' -Name WinApi -Namespace Native
$h=[IntPtr]([Int64]'${psString(handle)}')
[Native.WinApi]::MoveWindow($h,${Math.round(bounds.left)},${Math.round(bounds.top)},${width},${height},$true)|Out-Null`);
};

export const getCursorPosition = async () =>
  await runPowerShellJson<{ x: number; y: number }>(`
Add-Type -AssemblyName System.Windows.Forms
$p=[System.Windows.Forms.Cursor]::Position
[PSCustomObject]@{x=$p.X;y=$p.Y}|ConvertTo-Json -Compress`, { x: 0, y: 0 });

export const getWindowBounds = async (handle: string) => {
  const raw = await runPowerShellJson<Record<string, unknown> | null>(`
Add-Type -MemberDefinition '${psString(winApiSource)}' -Name WinApi -Namespace Native
$r=New-Object Native.WinApi+RECT
[Native.WinApi]::GetWindowRect([IntPtr]([Int64]'${psString(handle)}'),[ref]$r)|Out-Null
[PSCustomObject]@{left=$r.Left;top=$r.Top;right=$r.Right;bottom=$r.Bottom}|ConvertTo-Json -Compress`, null);
  return raw ? toBounds(raw) : null;
};
