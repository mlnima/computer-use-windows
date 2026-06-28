import { setTimeout as sleep } from 'node:timers/promises';
import type { Point } from '../types';
import { getCursorPosition, setCursorPosition } from '../windows/windows';

const cursorAtPoint = (cursor: Point, point: Point) =>
  cursor.x === point.x && cursor.y === point.y;

export const moveMouseExact = async (point: Point, cancelled: () => boolean) => {
  const target = { x: Math.round(point.x), y: Math.round(point.y) };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (cancelled()) throw new Error('Action cancelled.');
    await setCursorPosition(target);
    await sleep(12);
    const cursor = await getCursorPosition();
    if (cursorAtPoint(cursor, target)) return cursor;
  }
  const cursor = await getCursorPosition();
  throw new Error(`Cursor failed to reach exact target ${target.x},${target.y}; current position is ${cursor.x},${cursor.y}.`);
};
