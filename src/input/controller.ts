import { setTimeout as sleep } from 'node:timers/promises';
import type { Point } from '../types';
import { getCursorPosition, setCursorPosition } from '../windows/windows';
import { keyMap, type KeyEntry } from './keyMap';
import { createHumanMousePath } from './mousePath';
import { interception, keyboardDevice, mouseButtons, mouseDevice, mouseFlags, sendKey, sendMouse, type MouseButton } from './interception';

const heldButtons = new Set<MouseButton>();
const heldKeys = new Set<KeyEntry>();

const keyEntry = (key: string) => {
  const normalized = key.startsWith('Arrow') ? key.slice(5) : key === 'Return' ? 'Enter' : key;
  const entry = keyMap[normalized];
  if (!entry) throw new Error(`Unsupported key: ${key}`);
  return entry;
};

const keyDown = (entry: KeyEntry) => {
  sendKey(entry, true);
  heldKeys.add(entry);
};

const keyUp = (entry: KeyEntry) => {
  try { sendKey(entry, false); } finally { heldKeys.delete(entry); }
};

const mouseDown = (button: MouseButton) => {
  sendMouse(mouseFlags[button].down);
  heldButtons.add(button);
};

const mouseUp = (button: MouseButton) => {
  try { sendMouse(mouseFlags[button].up); } finally { heldButtons.delete(button); }
};

const pressEntry = async (entry: KeyEntry) => {
  const shift = entry.shift ? [keyMap.Shift!] : [];
  try {
    for (const item of shift) keyDown(item);
    keyDown(entry);
    await sleep(20);
  } finally {
    keyUp(entry);
    for (const item of shift.reverse()) keyUp(item);
  }
};

export const createInputController = (cancelled = () => false) => ({
  click: async (button: MouseButton) => {
    mouseDown(button);
    await sleep(35);
    mouseUp(button);
  },
  driverStatus: () => {
    try {
      mouseDevice(); keyboardDevice();
      return { available: true, error: null };
    } catch (error) {
      return { available: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
  getCursor: async (): Promise<Point> => await getCursorPosition(),
  holdKey: async (key: string, durationMs: number) => {
    const entry = keyEntry(key);
    let down = false;
    try {
      keyDown(entry);
      down = true;
      for (let waited = 0; waited < durationMs; waited += 50) {
        if (cancelled()) throw new Error('Action cancelled.');
        await sleep(Math.min(50, durationMs - waited));
      }
    } finally {
      if (down) keyUp(entry);
    }
  },
  keyDown: async (key: string) => keyDown(keyEntry(key)),
  keyUp: async (key: string) => keyUp(keyEntry(key)),
  mouseDown: async (button: MouseButton) => mouseDown(button),
  mouseUp: async (button: MouseButton) => mouseUp(button),
  moveAbsolute: async (x: number, y: number) => await setCursorPosition({ x, y }),
  moveDirect: async (dx: number, dy: number) => sendMouse(0, Math.round(dx), Math.round(dy)),
  moveHuman: async (dx: number, dy: number) => {
    for (const step of createHumanMousePath(dx, dy)) {
      if (cancelled()) throw new Error('Action cancelled.');
      sendMouse(0, step.dx, step.dy);
      await sleep(step.delayMs);
    }
  },
  press: async (key: string) => await pressEntry(keyEntry(key)),
  pressCombo: async (keys: string[]) => {
    const entries = keys.map(keyEntry);
    const held = entries.slice(0, -1);
    try {
      for (const entry of held) keyDown(entry);
      await pressEntry(entries.at(-1) || keyMap.Space!);
    } finally {
      for (const entry of held.reverse()) keyUp(entry);
    }
  },
  releaseAll: async () => {
    for (const entry of [...heldKeys].reverse()) {
      try { keyUp(entry); } catch {}
    }
    for (const button of [...new Set([...heldButtons, ...mouseButtons])]) {
      try { mouseUp(button); } catch {}
    }
  },
  scrollHorizontal: async (delta: number) => sendMouse(interception().api.MouseState.H_WHEEL, 0, 0, Math.round(delta)),
  scroll: async (delta: number) => sendMouse(interception().api.MouseState.WHEEL, 0, 0, Math.round(delta)),
  typeText: async (text: string) => {
    for (const char of text) {
      if (cancelled()) throw new Error('Action cancelled.');
      await pressEntry(keyEntry(char));
    }
  },
  wait: async (durationMs: number) => {
    for (let waited = 0; waited < durationMs; waited += 50) {
      if (cancelled()) throw new Error('Action cancelled.');
      await sleep(Math.min(50, durationMs - waited));
    }
  },
});
