import type { AccessibilityNode, Bounds, Point, ScreenshotInfo } from '../types';
import { psString, runPowerShell, runPowerShellJson } from '../util/powershell';
import { normalizeArray, toBounds, toPoint } from './value';

const boundsWidth = (bounds: Bounds) =>
  Math.max(1, bounds.right - bounds.left);

const boundsHeight = (bounds: Bounds) =>
  Math.max(1, bounds.bottom - bounds.top);

const localPoint = (point: Point, screenshot: ScreenshotInfo): Point => ({
  x: Math.round((point.x - screenshot.bounds.left) * (screenshot.width / boundsWidth(screenshot.bounds))),
  y: Math.round((point.y - screenshot.bounds.top) * (screenshot.height / boundsHeight(screenshot.bounds))),
});

const localBounds = (bounds: Bounds, screenshot: ScreenshotInfo): Bounds => ({
  bottom: localPoint({ x: bounds.right, y: bounds.bottom }, screenshot).y,
  left: localPoint({ x: bounds.left, y: bounds.top }, screenshot).x,
  right: localPoint({ x: bounds.right, y: bounds.bottom }, screenshot).x,
  top: localPoint({ x: bounds.left, y: bounds.top }, screenshot).y,
});

const pointInsideScreenshot = (point: Point, screenshot?: ScreenshotInfo) =>
  !screenshot || (point.x >= 0 && point.y >= 0 && point.x < screenshot.width && point.y < screenshot.height);

const accessibilityScript = (handle: string, maxNodes: number) => `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]([Int64]'${psString(handle)}'))
$items=New-Object System.Collections.Generic.List[object]
if($root -ne $null){
$all=$root.FindAll([System.Windows.Automation.TreeScope]::Subtree,[System.Windows.Automation.Condition]::TrueCondition)
for($i=0;$i -lt $all.Count -and $items.Count -lt ${maxNodes};$i++){
try{
$e=$all.Item($i);$c=$e.Current;if($c.IsOffscreen){continue}
$r=$c.BoundingRectangle;if($r.IsEmpty -or $r.Width -lt 1 -or $r.Height -lt 1){continue}
$v='';$vp=$null;if($e.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$vp)){$v=$vp.Current.Value}
$items.Add([PSCustomObject]@{id=("uia-"+($items.Count+1));role=$c.ControlType.ProgrammaticName.Replace("ControlType.","");name=[string]$c.Name;automationId=[string]$c.AutomationId;className=[string]$c.ClassName;enabled=$c.IsEnabled;focused=$c.HasKeyboardFocus;value=$v;bounds=[PSCustomObject]@{left=[int]$r.Left;top=[int]$r.Top;right=[int]$r.Right;bottom=[int]$r.Bottom};center=[PSCustomObject]@{x=[int]($r.Left+$r.Width/2);y=[int]($r.Top+$r.Height/2)}})|Out-Null
}catch{} } }
$items.ToArray()|ConvertTo-Json -Depth 6 -Compress`;

export const getAccessibility = async (handle: string, maxNodes: number, screenshot?: ScreenshotInfo) => {
  const raw = await runPowerShellJson<Record<string, unknown> | Record<string, unknown>[]>(
    accessibilityScript(handle, maxNodes),
    [],
  );
  return normalizeArray(raw).map((entry): AccessibilityNode => {
    const globalBounds = toBounds(entry.bounds);
    const globalCenter = toPoint(entry.center);
    const center = screenshot ? localPoint(globalCenter, screenshot) : globalCenter;
    return {
      automationId: String(entry.automationId || ''),
      bounds: screenshot ? localBounds(globalBounds, screenshot) : globalBounds,
      center,
      className: String(entry.className || ''),
      enabled: entry.enabled === true,
      focused: entry.focused === true,
      globalBounds,
      globalCenter,
      id: String(entry.id || ''),
      name: String(entry.name || ''),
      role: String(entry.role || ''),
      value: String(entry.value || ''),
    };
  }).filter((node) => pointInsideScreenshot(node.center, screenshot));
};

export const invokeAccessibility = async (handle: string, nodeId: string, action: string, value = '') => {
  const ordinal = Math.max(1, Number(nodeId.replace(/\D/g, '')) || 1) - 1;
  await runPowerShell(`
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]([Int64]'${psString(handle)}'))
$all=$root.FindAll([System.Windows.Automation.TreeScope]::Subtree,[System.Windows.Automation.Condition]::TrueCondition)
$e=$all.Item(${ordinal})
$p=$null
if('${psString(action)}' -eq 'value' -and $e.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$p)){$p.SetValue('${psString(value)}');return}
if('${psString(action)}' -eq 'toggle' -and $e.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern,[ref]$p)){$p.Toggle();return}
if($e.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$p)){$p.Invoke();return}
throw 'Requested UI Automation action is unavailable.'`);
};
