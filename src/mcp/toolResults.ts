export const textResult = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

export const okResult = (value: Record<string, unknown>) =>
  textResult({ ok: true, ...value });

export const toolError = (error: unknown, recovery = 'Call computer_status() and then computer_observe() before retrying.') => ({
  isError: true,
  ...textResult({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    recovery,
  }),
});
