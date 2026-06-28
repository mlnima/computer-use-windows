import { psString, runPowerShell } from '../util/powershell';

export const getClipboardText = async () =>
  await runPowerShell('Get-Clipboard -Raw -Format Text');

export const setClipboardText = async (text: string) => {
  await runPowerShell(text ? `Set-Clipboard -Value '${psString(text)}'` : "cmd.exe /c '<nul set /p=|clip'");
};

export const clearClipboard = async () => {
  await runPowerShell("cmd.exe /c '<nul set /p=|clip'");
};
