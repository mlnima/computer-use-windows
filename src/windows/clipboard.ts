import { psString, runPowerShell } from '../util/powershell';

export const getClipboardText = async () =>
  await runPowerShell('Get-Clipboard -Raw -Format Text');

export const setClipboardText = async (text: string) => {
  await runPowerShell(`Set-Clipboard -Value '${psString(text)}'`);
};

export const clearClipboard = async () => {
  await runPowerShell('Set-Clipboard -Value ""');
};
