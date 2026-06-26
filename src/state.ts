import os from 'node:os';
import { randomUUID } from 'node:crypto';
import type { Observation, ResourceRecord, TerminalSession } from './types';
import type { TransportMode } from './config';
import { closeAllTerminals } from './terminal/terminal';

export type RuntimeState = {
  actionCancelled: boolean;
  currentActionId: string | null;
  emergencyStopped: boolean;
  lastActions: Array<Record<string, unknown>>;
  lastError: string | null;
  latestObservation: Observation | null;
  machineId: string;
  paused: boolean;
  preservedClipboard: string | null;
  resources: Map<string, ResourceRecord>;
  sessionId: string;
  terminals: Map<string, TerminalSession>;
  transportMode: TransportMode;
};

export const createRuntimeState = (transportMode: TransportMode): RuntimeState => ({
  actionCancelled: false,
  currentActionId: null,
  emergencyStopped: false,
  lastActions: [],
  lastError: null,
  latestObservation: null,
  machineId: `${os.hostname()}-${os.userInfo().username}`,
  paused: false,
  preservedClipboard: null,
  resources: new Map(),
  sessionId: randomUUID(),
  terminals: new Map(),
  transportMode,
});

export const setLastError = (state: RuntimeState, error: unknown) => {
  state.lastError = error instanceof Error ? error.message : String(error);
};

export const addLastAction = (state: RuntimeState, action: Record<string, unknown>) => {
  state.lastActions.unshift({ ...action, at: new Date().toISOString() });
  state.lastActions = state.lastActions.slice(0, 100);
};

export const assertCanMutate = (state: RuntimeState) => {
  if (state.paused) throw new Error('Session is paused.');
  if (state.emergencyStopped) throw new Error('Emergency stop is active.');
};

export const cleanupRuntimeState = (state: RuntimeState) => {
  closeAllTerminals(state);
  state.preservedClipboard = null;
  state.resources.clear();
  state.latestObservation = null;
};
