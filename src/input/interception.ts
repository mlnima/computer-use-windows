import { createRequire } from 'node:module';
import type { KeyEntry } from './keyMap';

export type MouseButton = 'left' | 'middle' | 'right';
type Device = { send: (stroke: Record<string, unknown>) => boolean };
type Session = { getKeyboards: () => Device[]; getMice: () => Device[]; isDestroyed: () => boolean };
type Module = {
  Interception: new () => Session;
  KeyState: Record<string, number>;
  MouseFlag: Record<string, number>;
  MouseState: Record<string, number>;
};

const require = createRequire(import.meta.url);
export const mouseButtons: MouseButton[] = ['left', 'middle', 'right'];
export const mouseFlags = {
  left: { down: 1, up: 2 },
  middle: { down: 16, up: 32 },
  right: { down: 4, up: 8 },
};

let api: Module | null = null;
let session: Session | null = null;
let keyboard: Device | null = null;
let mouse: Device | null = null;

export const interception = () => {
  api ??= require('node-interception') as Module;
  if (!session || session.isDestroyed()) session = new api.Interception();
  return { api, session };
};

export const mouseDevice = () => {
  const current = interception().session;
  mouse ??= current.getMice()[0] || null;
  if (!mouse) throw new Error('node-interception mouse not available. Install driver and reboot Windows.');
  return mouse;
};

export const keyboardDevice = () => {
  const current = interception().session;
  keyboard ??= current.getKeyboards()[0] || null;
  if (!keyboard) throw new Error('node-interception keyboard not available. Install driver and reboot Windows.');
  return keyboard;
};

export const sendMouse = (state: number, x = 0, y = 0, rolling = 0) => {
  const ok = mouseDevice().send({
    flags: interception().api.MouseFlag.MOVE_RELATIVE,
    information: 0,
    rolling,
    state,
    type: 'mouse',
    x,
    y,
  });
  if (!ok) throw new Error('node-interception mouse send failed.');
};

export const sendKey = (entry: KeyEntry, down: boolean) => {
  const state = down
    ? entry.special ? interception().api.KeyState.E0 : interception().api.KeyState.DOWN
    : (entry.special ? interception().api.KeyState.E0 : 0) | interception().api.KeyState.UP;
  const ok = keyboardDevice().send({ code: entry.code, information: 0, state, type: 'keyboard' });
  if (!ok) throw new Error('node-interception keyboard send failed.');
};
