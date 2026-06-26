export type KeyEntry = { code: number; shift?: boolean; special?: boolean };

export const keyMap: Record<string, KeyEntry> = {
  Alt: { code: 0x38 },
  Backspace: { code: 0x0e },
  Control: { code: 0x1d },
  Delete: { code: 0x53, special: true },
  Down: { code: 0x50, special: true },
  Enter: { code: 0x1c },
  Escape: { code: 0x01 },
  Left: { code: 0x4b, special: true },
  Right: { code: 0x4d, special: true },
  Shift: { code: 0x2a },
  Space: { code: 0x39 },
  Tab: { code: 0x0f },
  Up: { code: 0x48, special: true },
  ' ': { code: 0x39 },
  '-': { code: 0x0c },
  '.': { code: 0x34 },
  '/': { code: 0x35 },
  '0': { code: 0x0b },
  '1': { code: 0x02 },
  '2': { code: 0x03 },
  '3': { code: 0x04 },
  '4': { code: 0x05 },
  '5': { code: 0x06 },
  '6': { code: 0x07 },
  '7': { code: 0x08 },
  '8': { code: 0x09 },
  '9': { code: 0x0a },
};

for (let index = 0; index < 26; index += 1) {
  const lower = String.fromCharCode(97 + index);
  const code = [0x1e, 0x30, 0x2e, 0x20, 0x12, 0x21, 0x22, 0x23, 0x17, 0x24, 0x25, 0x26, 0x32, 0x31, 0x18, 0x19, 0x10, 0x13, 0x1f, 0x14, 0x16, 0x2f, 0x11, 0x2d, 0x15, 0x2c][index]!;
  keyMap[lower] = { code };
  keyMap[lower.toUpperCase()] = { code, shift: true };
}
