import { randomUUID } from 'node:crypto';
import type { ServerConfig } from '../config';
import type { RuntimeState } from '../state';
import { addLastAction, assertCanMutate, markObservationConsumed } from '../state';
import { appendLog } from '../trace/trace';
import { pasteTextFast } from '../windows/fastText';
import { assertPointTargetsWindow, ensureForegroundWindow } from '../windows/windows';
import { createObservation } from '../observation/observe';
import type { Observation, Point, ScreenshotInfo } from '../types';
import { createInputController } from './controller';
import { assertVerificationPassed, verifyActionResult, type ActionVerification } from './verification';

type NativeAction = Record<string, unknown>;
type MouseButton = 'left' | 'right' | 'middle';

const mouseKinds = new Set([
  'clickPoint', 'doubleClickPoint', 'tripleClickPoint', 'triple_click',
  'dragPointDirect', 'dragPointHuman', 'movePointHuman', 'movePointDirect',
  'setCursorPosition', 'cursorPosition', 'cursor_position',
  'mouseDown', 'mouseUp', 'scroll',
]);

const untargetedKinds = new Set(['wait']);

const actionNumber = (...values: unknown[]) => {
  const value = values.map(Number).find(Number.isFinite);
  return value ?? 0;
};

const actionDurationMs = (action: NativeAction) =>
  Math.max(0, actionNumber(action.durationMs, action.ms, action.amount));

const actionDirectionAmount = (action: NativeAction) => {
  const direction = String(action.direction || '').toLowerCase();
  const amount = Math.abs(actionNumber(action.amount));
  if (direction === 'up') return { deltaX: 0, deltaY: amount };
  if (direction === 'down') return { deltaX: 0, deltaY: -amount };
  if (direction === 'left') return { deltaX: -amount, deltaY: 0 };
  if (direction === 'right') return { deltaX: amount, deltaY: 0 };
  return { deltaX: actionNumber(action.deltaX), deltaY: actionNumber(action.deltaY, action.delta) };
};

const requireObservation = (state: RuntimeState, token?: string) => {
  if (!state.latestObservation || state.latestObservation.token !== token) {
    throw new Error('A fresh observationToken from computer_observe is required.');
  }
  if (state.latestObservation.consumed || state.latestObservation.stale) {
    throw new Error('A fresh observationToken from computer_observe is required; this token is stale or consumed.');
  }
  return state.latestObservation;
};

const boundsWidth = (screenshot: ScreenshotInfo) =>
  Math.max(1, screenshot.bounds.right - screenshot.bounds.left);

const boundsHeight = (screenshot: ScreenshotInfo) =>
  Math.max(1, screenshot.bounds.bottom - screenshot.bounds.top);

const actionButton = (action: NativeAction): MouseButton =>
  action.button === 'right' || action.button === 'middle' ? action.button : 'left';

const actionHandle = (action: NativeAction) =>
  typeof action.windowHandle === 'string' ? action.windowHandle : '';

const actionScreenshot = (observation: Observation, action: NativeAction) => {
  const resourceId = typeof action.screenshotResourceId === 'string' ? action.screenshotResourceId : '';
  const handle = actionHandle(action);
  const resource = observation.screenshots.find((screenshot) => screenshot.resourceId === resourceId);
  if (!handle) throw new Error('Native input actions require windowHandle for the intended target window.');
  if (resourceId && resource?.windowHandle !== handle) {
    throw new Error('screenshotResourceId does not match the target windowHandle.');
  }
  return resource || observation.screenshots.find((screenshot) => screenshot.windowHandle === handle) || null;
};

const actionPoint = (observation: Observation, action: NativeAction, xKey: string, yKey: string) => {
  const x = Number(action[xKey]);
  const y = Number(action[yKey]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Action point requires numeric ${xKey} and ${yKey}.`);
  if (action.coordinateSpace !== 'screenshot') {
    throw new Error('Window mouse actions require coordinateSpace: "screenshot" from the current observation.');
  }
  const screenshot = actionScreenshot(observation, action);
  if (!screenshot) throw new Error('No window screenshot is available for screenshot coordinate input.');
  if (x < 0 || y < 0 || x >= screenshot.width || y >= screenshot.height) {
    throw new Error('Mouse input point is outside the current observed screenshot.');
  }
  return {
    x: Math.round(screenshot.bounds.left + x * (boundsWidth(screenshot) / Math.max(1, screenshot.width))),
    y: Math.round(screenshot.bounds.top + y * (boundsHeight(screenshot) / Math.max(1, screenshot.height))),
  };
};

const requireTargetHandle = (kind: string, windowHandle: string) => {
  if (!windowHandle && !untargetedKinds.has(kind)) {
    throw new Error('Native input actions require windowHandle for the intended target window.');
  }
};

const requireMouseTarget = async (kind: string, windowHandle: string, point: Point) => {
  if (!mouseKinds.has(kind)) return;
  await ensureForegroundWindow(windowHandle);
  await assertPointTargetsWindow(windowHandle, point);
};

const moveMouse = async (
  controller: ReturnType<typeof createInputController>,
  kind: string,
  windowHandle: string,
  point: Point,
) => {
  const cursor = kind === 'movePointHuman' || kind === 'dragPointHuman'
    ? await controller.moveHuman(point.x, point.y)
    : await controller.moveTo(point.x, point.y);
  await requireMouseTarget(kind, windowHandle, cursor);
  return cursor;
};

export const runComputerAction = async (
  state: RuntimeState,
  config: ServerConfig,
  observationToken: string | undefined,
  action: NativeAction,
  verification?: ActionVerification | null,
) => {
  assertCanMutate(state);
  const observation = requireObservation(state, observationToken);
  if (observation.securityPrompt.detected) {
    throw new Error(observation.securityPrompt.reason || 'Human takeover is required before continuing.');
  }
  state.actionCancelled = false;
  const controller = createInputController(() => state.actionCancelled || state.paused || state.emergencyStopped);
  const actionId = randomUUID();
  state.currentActionId = actionId;
  const kind = String(action.kind || '');
  const windowHandle = actionHandle(action);
  try {
    requireTargetHandle(kind, windowHandle);
    markObservationConsumed(state);
    if (windowHandle) await ensureForegroundWindow(windowHandle);
    const cursor = await controller.getCursor();
    if (kind === 'movePointHuman' || kind === 'movePointDirect') {
      const point = actionPoint(observation, action, 'x', 'y');
      await moveMouse(controller, kind, windowHandle, point);
    }
    else if (kind === 'setCursorPosition' || kind === 'cursorPosition' || kind === 'cursor_position') {
      const point = actionPoint(observation, action, 'x', 'y');
      await moveMouse(controller, kind, windowHandle, point);
    }
    else if (kind === 'clickPoint') {
      const point = actionPoint(observation, action, 'x', 'y');
      const actual = await moveMouse(controller, kind, windowHandle, point);
      await requireMouseTarget(kind, windowHandle, actual);
      await controller.click(actionButton(action));
    } else if (kind === 'doubleClickPoint') {
      const point = actionPoint(observation, action, 'x', 'y');
      const actual = await moveMouse(controller, kind, windowHandle, point);
      await requireMouseTarget(kind, windowHandle, actual);
      await controller.click(actionButton(action));
      await requireMouseTarget(kind, windowHandle, await controller.getCursor());
      await controller.click(actionButton(action));
    } else if (kind === 'tripleClickPoint') {
      const point = actionPoint(observation, action, 'x', 'y');
      await moveMouse(controller, kind, windowHandle, point);
      for (let count = 0; count < 3; count += 1) {
        await requireMouseTarget(kind, windowHandle, await controller.getCursor());
        await controller.click(actionButton(action));
      }
    } else if (kind === 'triple_click') {
      const point = Number.isFinite(Number(action.x)) && Number.isFinite(Number(action.y))
        ? actionPoint(observation, action, 'x', 'y')
        : cursor;
      await moveMouse(controller, kind, windowHandle, point);
      for (let count = 0; count < 3; count += 1) {
        await requireMouseTarget(kind, windowHandle, await controller.getCursor());
        await controller.click(actionButton(action));
      }
    } else if (kind === 'dragPointDirect' || kind === 'dragPointHuman') {
      const start = actionPoint(observation, action, 'x', 'y');
      const end = actionPoint(observation, action, 'toX', 'toY');
      await assertPointTargetsWindow(windowHandle, start);
      await assertPointTargetsWindow(windowHandle, end);
      await moveMouse(controller, kind, windowHandle, start);
      await requireMouseTarget(kind, windowHandle, await controller.getCursor());
      await controller.mouseDown(actionButton(action));
      await moveMouse(controller, kind, windowHandle, end);
      await requireMouseTarget(kind, windowHandle, await controller.getCursor());
      await controller.mouseUp(actionButton(action));
    } else if (kind === 'typeText') await controller.typeText(String(action.text || ''));
    else if (kind === 'typeTextFast') await pasteTextFast(String(action.text || ''));
    else if (kind === 'press') await controller.press(String(action.key || ''));
    else if (kind === 'pressCombo') await controller.pressCombo(Array.isArray(action.keys) ? action.keys.map(String) : []);
    else if (kind === 'holdKey' || kind === 'hold_key') await controller.holdKey(String(action.key || ''), actionDurationMs(action));
    else if (kind === 'keyDown') await controller.keyDown(String(action.key || ''));
    else if (kind === 'keyUp') await controller.keyUp(String(action.key || ''));
    else if (kind === 'mouseDown') {
      await requireMouseTarget(kind, windowHandle, cursor);
      await controller.mouseDown(actionButton(action));
    } else if (kind === 'mouseUp') {
      await requireMouseTarget(kind, windowHandle, cursor);
      await controller.mouseUp(actionButton(action));
    }
    else if (kind === 'scroll') {
      const hasPoint = Number.isFinite(Number(action.x)) && Number.isFinite(Number(action.y));
      const point = hasPoint ? actionPoint(observation, action, 'x', 'y') : cursor;
      if (hasPoint) await moveMouse(controller, kind, windowHandle, point);
      await requireMouseTarget(kind, windowHandle, await controller.getCursor());
      const { deltaX, deltaY } = actionDirectionAmount(action);
      if (deltaX) await controller.scrollHorizontal(deltaX);
      if (deltaY) await controller.scroll(deltaY);
    } else if (kind === 'wait') await controller.wait(actionDurationMs(action));
    else throw new Error(`Unsupported action kind: ${kind}`);
    addLastAction(state, { action, actionId, kind, machineId: state.machineId });
    appendLog(config, { action, actionId, kind, machineId: state.machineId, tool: 'computer_act' });
    const followUpObservation = await createObservation(state, config, { handles: windowHandle ? [windowHandle] : undefined, includeAccessibility: Boolean(verification) });
    const verificationResult = verifyActionResult(state, followUpObservation, verification);
    assertVerificationPassed(verificationResult);
    return { actionId, followUpObservation, machineId: state.machineId, previousObservation: observation.id, verification: verificationResult };
  } catch (error) {
    await controller.releaseAll();
    throw error;
  } finally {
    state.currentActionId = null;
  }
};
