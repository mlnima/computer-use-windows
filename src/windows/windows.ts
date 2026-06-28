import type { Bounds, Point, WindowInfo } from '../types';
import { setTimeout as sleep } from 'node:timers/promises';
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

export const foregroundWindowStatus = async (handle: string) => {
  const windows = await listWindows();
  const focusedWindow = windows.find((entry) => entry.isForeground) || null;
  return {
    focusedWindow,
    isForeground: focusedWindow?.handle === handle,
    targetWindow: windows.find((entry) => entry.handle === handle) || null,
  };
};

export const isWindowForeground = async (handle: string) =>
  (await foregroundWindowStatus(handle)).isForeground;

export const bringWindowToForeground = async (handle: string) => {
  await runPowerShell(`
Add-Type -MemberDefinition '${psString(winApiSource)}' -Name WinApi -Namespace Native
$h=[IntPtr]([Int64]'${psString(handle)}')
$fg=[Native.WinApi]::GetForegroundWindow()
$targetPid=[uint32]0
$foregroundPid=[uint32]0
$targetThread=[Native.WinApi]::GetWindowThreadProcessId($h,[ref]$targetPid)
$foregroundThread=[Native.WinApi]::GetWindowThreadProcessId($fg,[ref]$foregroundPid)
$currentThread=[Native.WinApi]::GetCurrentThreadId()
$attachedCurrent=$false
$attachedForeground=$false
try {
if($currentThread -ne $targetThread){$attachedCurrent=[Native.WinApi]::AttachThreadInput($currentThread,$targetThread,$true)}
if($foregroundThread -ne 0 -and $foregroundThread -ne $targetThread){$attachedForeground=[Native.WinApi]::AttachThreadInput($foregroundThread,$targetThread,$true)}
[Native.WinApi]::keybd_event(0x12,0,0,[UIntPtr]::Zero)
[Native.WinApi]::keybd_event(0x12,0,2,[UIntPtr]::Zero)
[Native.WinApi]::ShowWindowAsync($h,9)|Out-Null
[Native.WinApi]::BringWindowToTop($h)|Out-Null
[Native.WinApi]::SetActiveWindow($h)|Out-Null
[Native.WinApi]::SetFocus($h)|Out-Null
[Native.WinApi]::SetForegroundWindow($h)|Out-Null
} finally {
if($attachedForeground){[Native.WinApi]::AttachThreadInput($foregroundThread,$targetThread,$false)|Out-Null}
if($attachedCurrent){[Native.WinApi]::AttachThreadInput($currentThread,$targetThread,$false)|Out-Null}
}`);
};

export const ensureForegroundWindow = async (handle: string) => {
  let status = await foregroundWindowStatus(handle);
  if (!status.targetWindow) throw new Error(`Window not found: ${handle}`);
  if (status.isForeground) return { ...status, changed: false };
  await bringWindowToForeground(handle);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await sleep(75);
    status = await foregroundWindowStatus(handle);
    if (status.isForeground) return { ...status, changed: true };
  }
  const current = status.focusedWindow ? `${status.focusedWindow.title} (${status.focusedWindow.handle})` : 'none';
  throw new Error(`Window did not become foreground: ${status.targetWindow?.title || handle}. Current foreground: ${current}`);
};

export const focusWindow = ensureForegroundWindow;

export const pointWindowStatus = async (handle: string, point: Point) =>
  await runPowerShellJson<{
    isTarget: boolean;
    pointRootHandle: string;
    pointWindowHandle: string;
    targetRootHandle: string;
  }>(`
Add-Type -MemberDefinition '${psString(winApiSource)}' -Name WinApi -Namespace Native
[Native.WinApi]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null
$target=[IntPtr]([Int64]'${psString(handle)}')
$p=New-Object Native.WinApi+POINT
$p.X=${Math.round(point.x)}
$p.Y=${Math.round(point.y)}
$pointWindow=[Native.WinApi]::WindowFromPoint($p)
$targetRoot=[Native.WinApi]::GetAncestor($target,2)
$pointRoot=[Native.WinApi]::GetAncestor($pointWindow,2)
if($targetRoot -eq [IntPtr]::Zero){$targetRoot=$target}
if($pointRoot -eq [IntPtr]::Zero){$pointRoot=$pointWindow}
[PSCustomObject]@{isTarget=($pointRoot -eq $targetRoot);pointWindowHandle=$pointWindow.ToInt64().ToString();pointRootHandle=$pointRoot.ToInt64().ToString();targetRootHandle=$targetRoot.ToInt64().ToString()}|ConvertTo-Json -Compress`,
  { isTarget: false, pointRootHandle: '', pointWindowHandle: '', targetRootHandle: '' });

export const assertPointTargetsWindow = async (handle: string, point: Point) => {
  const status = await pointWindowStatus(handle, point);
  if (status.isTarget) return status;
  throw new Error(`Mouse input aborted because point ${Math.round(point.x)},${Math.round(point.y)} targets window ${status.pointRootHandle || status.pointWindowHandle || 'none'} instead of ${status.targetRootHandle || handle}.`);
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
Add-Type -MemberDefinition '${psString(winApiSource)}' -Name WinApi -Namespace Native
[Native.WinApi]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null
$p=New-Object Native.WinApi+POINT
[Native.WinApi]::GetCursorPos([ref]$p)|Out-Null
[PSCustomObject]@{x=[int]$p.X;y=[int]$p.Y}|ConvertTo-Json -Compress`, { x: 0, y: 0 });

export const setCursorPosition = async (point: Point) => {
  await runPowerShell(`
Add-Type -MemberDefinition '${psString(winApiSource)}' -Name WinApi -Namespace Native
[Native.WinApi]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null
[Native.WinApi]::SetCursorPos(${Math.round(point.x)},${Math.round(point.y)})|Out-Null`);
};

export const getWindowBounds = async (handle: string) => {
  const raw = await runPowerShellJson<Record<string, unknown> | null>(`
Add-Type -MemberDefinition '${psString(winApiSource)}' -Name WinApi -Namespace Native
$r=New-Object Native.WinApi+RECT
[Native.WinApi]::GetWindowRect([IntPtr]([Int64]'${psString(handle)}'),[ref]$r)|Out-Null
[PSCustomObject]@{left=$r.Left;top=$r.Top;right=$r.Right;bottom=$r.Bottom}|ConvertTo-Json -Compress`, null);
  return raw ? toBounds(raw) : null;
};
