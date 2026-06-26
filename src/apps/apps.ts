import path from 'node:path';
import { psString, runPowerShell, runPowerShellJson } from '../util/powershell';

export type AppEntry = { id: string; name: string; command: string; source: string };

const blocked = (app: AppEntry, rules: string[]) => {
  const text = `${app.id} ${app.name} ${app.command}`.toLowerCase();
  return rules.some((rule) => text.includes(rule.toLowerCase()));
};

export const listApps = async (rules: string[], includeBuiltIn = false) => {
  const raw = await runPowerShellJson<Array<Record<string, unknown>>>(`
$items=@()
Get-StartApps | ForEach-Object {
$items += [PSCustomObject]@{id=$_.AppID;name=$_.Name;command=("shell:AppsFolder\\"+$_.AppID);source='start'}
}
$uninstall=@(
'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
Get-ItemProperty $uninstall -ErrorAction SilentlyContinue | Where-Object {$_.DisplayName} | ForEach-Object {
$cmd=[string]($_.DisplayIcon -replace ',\\d+$','')
if(!$cmd -and $_.InstallLocation){$cmd=[string]$_.InstallLocation}
$items += [PSCustomObject]@{id=([string]($_.PSChildName));name=([string]$_.DisplayName);command=$cmd;source='registry'}
}
Get-Command -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 700 | ForEach-Object {
$items += [PSCustomObject]@{id=$_.Source;name=$_.Name;command=$_.Source;source='path'}
}
Get-Process | Where-Object {$_.MainWindowHandle -ne 0 -and $_.Path} | ForEach-Object {
$items += [PSCustomObject]@{id=$_.Path;name=$_.ProcessName;command=$_.Path;source='running'}
}
$items | Where-Object {$_.id -and $_.name} | Sort-Object id -Unique | ConvertTo-Json -Depth 4 -Compress`, []);
  const apps = raw.map((entry): AppEntry => ({
    command: String(entry.command || ''),
    id: String(entry.id || ''),
    name: String(entry.name || ''),
    source: String(entry.source || 'start'),
  })).filter((app) => app.id && app.name);
  const filtered = includeBuiltIn ? apps : apps.filter((app) => !/^microsoft|^windows/i.test(app.name));
  return filtered.filter((app) => !blocked(app, rules));
};

export const searchApps = async (query: string, rules: string[], includeBuiltIn = false) => {
  const lower = query.toLowerCase();
  return (await listApps(rules, includeBuiltIn))
    .filter((app) => `${app.name} ${app.id} ${app.command}`.toLowerCase().includes(lower))
    .slice(0, 20);
};

export const runApp = async (app: AppEntry, args: string[] = [], cwd?: string) => {
  const extra = args.map((arg) => `'${psString(arg)}'`).join(',');
  const working = cwd ? `-WorkingDirectory '${psString(path.resolve(cwd))}'` : '';
  await runPowerShell(`Start-Process '${psString(app.command)}' ${working} ${extra ? `-ArgumentList @(${extra})` : ''}`);
};
