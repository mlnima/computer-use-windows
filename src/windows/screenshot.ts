import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { Bounds } from '../types';
import type { ServerConfig } from '../config';
import type { RuntimeState } from '../state';
import { runPowerShell } from '../util/powershell';
import { addBytesResource } from '../resources/store';
import { ensureTraceDirs } from '../trace/trace';

const captureBase64 = async (bounds?: Bounds) => {
  const region = bounds
    ? `$b=New-Object System.Drawing.Rectangle(${bounds.left},${bounds.top},${bounds.right - bounds.left},${bounds.bottom - bounds.top})`
    : '$b=[System.Windows.Forms.SystemInformation]::VirtualScreen';
  return await runPowerShell(`
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
${region}
$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height
$g=[System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size)
$s=New-Object System.IO.MemoryStream
$bmp.Save($s,[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$bmp.Dispose()
[Convert]::ToBase64String($s.ToArray())`);
};

export const captureScreenshotResource = async (
  state: RuntimeState,
  config: ServerConfig,
  bounds?: Bounds,
) => {
  ensureTraceDirs(config);
  const raw = Buffer.from(await captureBase64(bounds), 'base64');
  const image = sharp(raw);
  const metadata = await image.metadata();
  const max = Math.max(metadata.width || 1, metadata.height || 1);
  const rawFits = raw.byteLength <= config.screenshotMaxBytes && max <= config.screenshotMaxSide;
  const buffer = rawFits
    ? raw
    : await image.resize({ fit: 'inside', height: config.screenshotMaxSide, width: config.screenshotMaxSide }).jpeg({ quality: 80 }).toBuffer();
  const mimeType = rawFits ? 'image/png' : 'image/jpeg';
  const file = path.join(config.screenshotsDir, `${Date.now()}${rawFits ? '.png' : '.jpg'}`);
  fs.writeFileSync(file, buffer);
  return addBytesResource(state, path.basename(file), mimeType, buffer, 'screenshots');
};
