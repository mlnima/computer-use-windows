# browser-use-native-windows Agent Rules

- This package is standalone.
- Do not import from internal project packages, including `@repo/*`.
- Do not import from browser-control or computer-control.
- Development source files must be TypeScript `.ts` files.
- Local TypeScript imports must be extensionless.
- All MCP prompt text must live under `src/prompts`.
- Prompt sections must be named exported variables using template literals.
- Do not build prompt markdown with arrays, `.join`, or `\n` chains.
- Stdio mode must write diagnostics only to stderr.
- Code files must stay under 300 lines.
