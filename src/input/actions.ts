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

const requireObservation = (state: RuntimeState, token?: string) => {
  if (!state.latestObservation || state.latestObservation.token !== token) {
    throw new Error('A fresh observationToken from computer_observe is required.');
  }
  return state.latestObservation;
};

const actionPoint = (observation: ReturnType<typeof requireObservation>, action: NativeAction, xKey: string, yKey: string) => {
  const x = Number(action[xKey]);
  const y = Number(action[yKey]);
  return action.coordinateSpace === 'screenshot'
    ? { x: x + observation.virtualDesktopBounds.left, y: y + observation.virtualDesktopBounds.top }
    : { x, y };
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
  const controller = createInputController(() => state.actionCancelled);
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
    else if (kind === 'clickPoint') {
      await controller.moveDirect(x - cursor.x, y - cursor.y);
      await controller.click((action.button as 'left') || 'left');
    } else if (kind === 'doubleClickPoint') {
      await controller.moveDirect(x - cursor.x, y - cursor.y);
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
    else if (kind === 'keyDown') await controller.keyDown(String(action.key || ''));
    else if (kind === 'keyUp') await controller.keyUp(String(action.key || ''));
    else if (kind === 'mouseDown') await controller.mouseDown((action.button as 'left') || 'left');
    else if (kind === 'mouseUp') await controller.mouseUp((action.button as 'left') || 'left');
    else if (kind === 'scroll') await controller.scroll(Number(action.delta || action.deltaY || 0));
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
