import type { MonitorInfo } from '../types';
import { runPowerShellJson } from '../util/powershell';
import { normalizeArray, toMonitor } from './value';

export const listMonitors = async (): Promise<MonitorInfo[]> => {
  const raw = await runPowerShellJson<Record<string, unknown> | Record<string, unknown>[]>(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Screen]::AllScreens | ForEach-Object {
[PSCustomObject]@{
id=$_.DeviceName;name=$_.DeviceName;isPrimary=$_.Primary;
bounds=[PSCustomObject]@{left=$_.Bounds.Left;top=$_.Bounds.Top;right=$_.Bounds.Right;bottom=$_.Bounds.Bottom};
workArea=[PSCustomObject]@{left=$_.WorkingArea.Left;top=$_.WorkingArea.Top;right=$_.WorkingArea.Right;bottom=$_.WorkingArea.Bottom}
}} | ConvertTo-Json -Depth 6 -Compress`, []);
  return normalizeArray(raw).map(toMonitor);
};
