import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { Bounds, MonitorInfo, ScreenshotInfo, WindowInfo } from '../types';
import type { ServerConfig } from '../config';
import type { RuntimeState } from '../state';
import { runPowerShell } from '../util/powershell';
import { addBytesResource } from '../resources/store';
import { ensureTraceDirs } from '../trace/trace';

type NormalizedImage = { buffer: Buffer; height: number; mimeType: 'image/png' | 'image/jpeg'; width: number };
const qualitySteps = [90, 82, 74, 66, 58, 50, 42, 34];
const boundsWidth = (bounds: Bounds) => Math.max(1, Math.round(bounds.right - bounds.left));
const boundsHeight = (bounds: Bounds) => Math.max(1, Math.round(bounds.bottom - bounds.top));

const intersectBounds = (a: Bounds, b: Bounds) => {
  const bounds = {
    bottom: Math.min(a.bottom, b.bottom),
    left: Math.max(a.left, b.left),
    right: Math.min(a.right, b.right),
    top: Math.max(a.top, b.top),
  };
  return bounds.right > bounds.left && bounds.bottom > bounds.top ? bounds : null;
};

const unionBounds = (items: Bounds[]) => ({
  bottom: Math.max(...items.map((entry) => entry.bottom)), left: Math.min(...items.map((entry) => entry.left)),
  right: Math.max(...items.map((entry) => entry.right)), top: Math.min(...items.map((entry) => entry.top)),
});
const visibleBounds = (target: Bounds, monitors: MonitorInfo[]) => {
  const intersections = monitors.map((monitor) => intersectBounds(target, monitor.bounds)).filter((entry): entry is Bounds => !!entry);
  return intersections.length > 0 ? unionBounds(intersections) : target;
};

const sideGrid = (maxSide: number, start: number) => {
  const values = new Set<number>();
  for (const factor of [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) {
    values.add(Math.max(1, Math.round(Math.min(maxSide, start) * factor)));
  }
  return Array.from(values).sort((a, b) => b - a);
};

const captureBase64 = async (bounds: Bounds) =>
  await runPowerShell(`
Add-Type -AssemblyName System.Drawing
$b=New-Object System.Drawing.Rectangle(${Math.round(bounds.left)},${Math.round(bounds.top)},${boundsWidth(bounds)},${boundsHeight(bounds)})
$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height
$g=[System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size)
$s=New-Object System.IO.MemoryStream
$bmp.Save($s,[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$bmp.Dispose()
[Convert]::ToBase64String($s.ToArray())`);

const normalizeImage = async (buffer: Buffer, config: ServerConfig): Promise<NormalizedImage> => {
  const metadata = await sharp(buffer).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const maxDim = Math.max(width, height);
  if (buffer.byteLength <= config.screenshotMaxBytes && (maxDim === 0 || (width <= config.screenshotMaxSide && height <= config.screenshotMaxSide))) {
    return { buffer, height: Math.max(1, height), mimeType: 'image/png', width: Math.max(1, width) };
  }
  let smallest: Buffer | null = null;
  for (const side of sideGrid(config.screenshotMaxSide, maxDim || config.screenshotMaxSide)) {
    for (const quality of qualitySteps) {
      const out = await sharp(buffer).resize({ fit: 'inside', height: side, width: side, withoutEnlargement: true }).jpeg({ quality }).toBuffer();
      smallest = !smallest || out.byteLength < smallest.byteLength ? out : smallest;
      if (out.byteLength > config.screenshotMaxBytes) continue;
      const meta = await sharp(out).metadata();
      return { buffer: out, height: Number(meta.height || 1), mimeType: 'image/jpeg', width: Number(meta.width || 1) };
    }
  }
  const size = ((smallest?.byteLength || buffer.byteLength) / (1024 * 1024)).toFixed(2);
  throw new Error(`Computer screenshot could not be reduced below ${(config.screenshotMaxBytes / (1024 * 1024)).toFixed(0)}MB (got ${size}MB)`);
};

const captureWindowScreenshot = async (state: RuntimeState, config: ServerConfig, window: WindowInfo, monitors: MonitorInfo[]): Promise<ScreenshotInfo> => {
  ensureTraceDirs(config);
  const bounds = visibleBounds(window.bounds, monitors);
  const raw = Buffer.from(await captureBase64(bounds), 'base64');
  const normalized = await normalizeImage(raw, config);
  const file = path.join(config.screenshotsDir, `${Date.now()}-${window.handle}.${normalized.mimeType === 'image/jpeg' ? 'jpg' : 'png'}`);
  fs.writeFileSync(file, normalized.buffer);
  return {
    bounds,
    byteLength: normalized.buffer.byteLength,
    coordinateSpace: 'screenshot',
    height: normalized.height,
    mimeType: normalized.mimeType,
    resourceId: addBytesResource(state, path.basename(file), normalized.mimeType, normalized.buffer, 'screenshots'),
    width: normalized.width,
    windowHandle: window.handle,
  };
};

export const captureScreenshotResources = async (state: RuntimeState, config: ServerConfig, windows: WindowInfo[], monitors: MonitorInfo[]) => {
  const targets = windows.filter((window) => !window.isMinimized && boundsWidth(window.bounds) > 0 && boundsHeight(window.bounds) > 0);
  return await Promise.all(targets.map((window) => captureWindowScreenshot(state, config, window, monitors)));
};
