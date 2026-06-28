import { setTimeout as sleep } from 'node:timers/promises';
import type { Point } from '../types';
import { getCursorPosition } from '../windows/windows';
import { sendMouse } from './interception';
import { createHumanMousePath } from './mousePath';

const stepLimit = 128;

const cursorAtPoint = (cursor: Point, point: Point) =>
  cursor.x === point.x && cursor.y === point.y;

const splitStep = (dx: number, dy: number) => {
  const parts = Math.max(1, Math.ceil(Math.abs(dx) / stepLimit), Math.ceil(Math.abs(dy) / stepLimit));
  let movedX = 0;
  let movedY = 0;
  return Array.from({ length: parts }, (_entry, index) => {
    const targetX = Math.round(dx * (index + 1) / parts);
    const targetY = Math.round(dy * (index + 1) / parts);
    const step = { dx: targetX - movedX, dy: targetY - movedY };
    movedX = targetX;
    movedY = targetY;
    return step;
  }).filter((step) => step.dx || step.dy);
};

const moveRelativeHuman = async (dx: number, dy: number, cancelled: () => boolean) => {
  for (const step of createHumanMousePath(dx, dy)) {
    for (const split of splitStep(step.dx, step.dy)) {
      if (cancelled()) throw new Error('Action cancelled.');
      sendMouse(0, split.dx, split.dy);
      await sleep(Math.max(1, Math.round(step.delayMs / 2)));
    }
  }
};

export const moveMouseHuman = async (point: Point, cancelled: () => boolean) => {
  const target = { x: Math.round(point.x), y: Math.round(point.y) };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (cancelled()) throw new Error('Action cancelled.');
    const cursor = await getCursorPosition();
    if (cursorAtPoint(cursor, target)) return cursor;
    await moveRelativeHuman(target.x - cursor.x, target.y - cursor.y, cancelled);
    await sleep(12);
  }
  const cursor = await getCursorPosition();
  if (cursorAtPoint(cursor, target)) return cursor;
  throw new Error(`Cursor failed to reach human target ${target.x},${target.y}; current position is ${cursor.x},${cursor.y}.`);
};
