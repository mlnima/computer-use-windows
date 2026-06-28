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
- Screenshots must use selected window/app bounds like `browser-use-native-windows`; never send full virtual desktop or all-monitor screenshots to models. Multiple selected windows must return multiple screenshot resources.
- no specifict application name or information must be in the code base, this is a general use computeruse mcp server and must not have any name or brand or hard coded information about any application which are native or none native to the windows.