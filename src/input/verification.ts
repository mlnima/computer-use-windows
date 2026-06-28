import type { Observation } from '../types';
import type { RuntimeState } from '../state';
import { readResourceByUri } from '../resources/store';

export type ActionVerification = Record<string, unknown>;

type VerificationCheck = {
  actual: string;
  expected: string;
  name: string;
  ok: boolean;
};

const values = (value: unknown) =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : typeof value === 'string' && value ? [value] : [];

const includesAll = (actual: string, expected: string[]) =>
  expected.every((entry) => actual.toLowerCase().includes(entry.toLowerCase()));

const resourceText = (state: RuntimeState, uri: string) =>
  readResourceByUri(state, uri)?.text || '';

const accessibilityText = (state: RuntimeState, observation: Observation) =>
  observation.accessibilityResourceIds.map((uri) => resourceText(state, uri)).join('\n');

const addCheck = (checks: VerificationCheck[], name: string, expected: string, actual: string, ok: boolean) => {
  checks.push({ actual, expected, name, ok });
};

export const verifyActionResult = (state: RuntimeState, observation: Observation, verification?: ActionVerification | null) => {
  if (!verification) return { checks: [] as VerificationCheck[], ok: true };
  const checks: VerificationCheck[] = [];
  const focusedWindowHandle = typeof verification.focusedWindowHandle === 'string'
    ? verification.focusedWindowHandle
    : typeof verification.windowHandle === 'string'
      ? verification.windowHandle
      : '';
  if (focusedWindowHandle) {
    const actual = observation.focusedWindow?.handle || '';
    addCheck(checks, 'focusedWindowHandle', focusedWindowHandle, actual, actual === focusedWindowHandle);
  }
  const selectedWindowTitleIncludes = values(verification.selectedWindowTitleIncludes);
  if (selectedWindowTitleIncludes.length > 0) {
    const actual = observation.selectedWindows.map((window) => window.title).join('\n');
    addCheck(checks, 'selectedWindowTitleIncludes', selectedWindowTitleIncludes.join(' | '), actual, includesAll(actual, selectedWindowTitleIncludes));
  }
  const accessibilityIncludes = [
    ...values(verification.accessibilityTextIncludes),
    ...values(verification.accessibilityNameIncludes),
  ];
  if (accessibilityIncludes.length > 0) {
    const actual = accessibilityText(state, observation);
    addCheck(checks, 'accessibilityTextIncludes', accessibilityIncludes.join(' | '), actual, includesAll(actual, accessibilityIncludes));
  }
  const accessibilityTextMatches = typeof verification.accessibilityTextMatches === 'string' ? verification.accessibilityTextMatches : '';
  if (accessibilityTextMatches) {
    const actual = accessibilityText(state, observation);
    const ok = new RegExp(accessibilityTextMatches, 'i').test(actual);
    addCheck(checks, 'accessibilityTextMatches', accessibilityTextMatches, actual, ok);
  }
  return { checks, ok: checks.every((check) => check.ok) };
};

export const assertVerificationPassed = (result: ReturnType<typeof verifyActionResult>) => {
  if (result.ok) return;
  const failed = result.checks.filter((check) => !check.ok)
    .map((check) => `${check.name} expected "${check.expected}" but got "${check.actual.slice(0, 240)}"`)
    .join('; ');
  throw new Error(`Action verification failed: ${failed}`);
};
