import { randomUUID } from 'node:crypto';
import type { ServerConfig } from '../config';
import type { RuntimeState } from '../state';
import { addLastAction, assertCanMutate } from '../state';
import { appendLog } from '../trace/trace';
import { pasteTextFast } from '../windows/fastText';
import { focusWindow } from '../windows/windows';
import { createObservation } from '../observation/observe';
import { createInputController } from './controller';

type NativeAction = Record<string, unknown>;

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
  return state.latestObservation;
};

const actionScreenshot = (observation: ReturnType<typeof requireObservation>, action: NativeAction) => {
  const resourceId = typeof action.screenshotResourceId === 'string' ? action.screenshotResourceId : '';
  const handle = typeof action.windowHandle === 'string' ? action.windowHandle : '';
  return observation.screenshots.find((screenshot) => screenshot.resourceId === resourceId)
    || observation.screenshots.find((screenshot) => screenshot.windowHandle === handle)
    || observation.screenshots[0]
    || null;
};

const actionPoint = (observation: ReturnType<typeof requireObservation>, action: NativeAction, xKey: string, yKey: string) => {
  const x = Number(action[xKey]);
  const y = Number(action[yKey]);
  if (action.coordinateSpace !== 'screenshot') return { x, y };
  const screenshot = actionScreenshot(observation, action);
  if (!screenshot) throw new Error('No window screenshot is available for screenshot coordinate input.');
  return { x: x + screenshot.bounds.left, y: y + screenshot.bounds.top };
};

export const runComputerAction = async (
  state: RuntimeState,
  config: ServerConfig,
  observationToken: string | undefined,
  action: NativeAction,
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
  try {
    if (typeof action.windowHandle === 'string') await focusWindow(action.windowHandle);
    const cursor = await controller.getCursor();
    const start = actionPoint(observation, action, 'x', 'y');
    const end = actionPoint(observation, action, 'toX', 'toY');
    const { x, y } = start;
    const { x: toX, y: toY } = end;
    if (kind === 'movePointHuman') await controller.moveHuman(x - cursor.x, y - cursor.y);
    else if (kind === 'movePointDirect') await controller.moveDirect(x - cursor.x, y - cursor.y);
    else if (kind === 'setCursorPosition' || kind === 'cursorPosition' || kind === 'cursor_position') await controller.moveAbsolute(x, y);
    else if (kind === 'clickPoint') {
      await controller.moveDirect(x - cursor.x, y - cursor.y);
      await controller.click((action.button as 'left') || 'left');
    } else if (kind === 'doubleClickPoint') {
      await controller.moveDirect(x - cursor.x, y - cursor.y);
      await controller.click((action.button as 'left') || 'left');
      await controller.click((action.button as 'left') || 'left');
    } else if (kind === 'tripleClickPoint') {
      await controller.moveDirect(x - cursor.x, y - cursor.y);
      await controller.click((action.button as 'left') || 'left');
      await controller.click((action.button as 'left') || 'left');
      await controller.click((action.button as 'left') || 'left');
    } else if (kind === 'triple_click') {
      if (Number.isFinite(x) && Number.isFinite(y)) await controller.moveAbsolute(x, y);
      await controller.click((action.button as 'left') || 'left');
      await controller.click((action.button as 'left') || 'left');
      await controller.click((action.button as 'left') || 'left');
    } else if (kind === 'dragPointDirect' || kind === 'dragPointHuman') {
      await controller.moveDirect(x - cursor.x, y - cursor.y);
      await controller.mouseDown((action.button as 'left') || 'left');
      if (kind === 'dragPointHuman') await controller.moveHuman(toX - x, toY - y);
      else await controller.moveDirect(toX - x, toY - y);
      await controller.mouseUp((action.button as 'left') || 'left');
    } else if (kind === 'typeText') await controller.typeText(String(action.text || ''));
    else if (kind === 'typeTextFast') await pasteTextFast(String(action.text || ''));
    else if (kind === 'press') await controller.press(String(action.key || ''));
    else if (kind === 'pressCombo') await controller.pressCombo(Array.isArray(action.keys) ? action.keys.map(String) : []);
    else if (kind === 'holdKey' || kind === 'hold_key') await controller.holdKey(String(action.key || ''), actionDurationMs(action));
    else if (kind === 'keyDown') await controller.keyDown(String(action.key || ''));
    else if (kind === 'keyUp') await controller.keyUp(String(action.key || ''));
    else if (kind === 'mouseDown') await controller.mouseDown((action.button as 'left') || 'left');
    else if (kind === 'mouseUp') await controller.mouseUp((action.button as 'left') || 'left');
    else if (kind === 'scroll') {
      const { deltaX, deltaY } = actionDirectionAmount(action);
      if (deltaX) await controller.scrollHorizontal(deltaX);
      if (deltaY) await controller.scroll(deltaY);
    } else if (kind === 'wait') await controller.wait(actionDurationMs(action));
    else throw new Error(`Unsupported action kind: ${kind}`);
    addLastAction(state, { action, actionId, kind, machineId: state.machineId });
    appendLog(config, { action, actionId, kind, machineId: state.machineId, tool: 'computer_act' });
    const followUpObservation = await createObservation(state, config, { includeAccessibility: false });
    return { actionId, followUpObservation, machineId: state.machineId, previousObservation: observation.id };
  } catch (error) {
    await controller.releaseAll();
    throw error;
  } finally {
    state.currentActionId = null;
  }
};
