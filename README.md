# computer-use-windows

Standalone MCP server for controlling a real Windows desktop from Codex or another MCP client.

## Install

```powershell
npm install
npm run build
```

Run these commands from the package root when this package is moved to:

```text
https://github.com/mlnima/computer-use-windows.git
```

## Transports

- Server: `npm start`
- STDIO: `node <package-root>\dist\index.js --transport stdio`

The start script runs one server that exposes both `/mcp` and `/sse` on the same host, port, and auth token. STDIO uses the built `dist\index.js` file directly.

The Streamable HTTP endpoint is:

```text
http://127.0.0.1:7332/mcp
```

Codex Desktop should use the URL ending in `/mcp`.

SSE uses:

```text
http://127.0.0.1:7332/sse
```

Each Windows computer should run its own server process. Add each computer as a separate MCP entry, for example `windows-office`, `windows-lab`, or `windows-gpu`. Use the `machineId`, `hostname`, and `username` fields from `computer_status` to avoid mixing actions across computers.

## Codex Config

STDIO:

```json
{
  "mcpServers": {
    "computer-use-windows": {
      "command": "node",
      "args": ["<package-root>\\dist\\index.js", "--transport", "stdio"]
    }
  }
}
```

Codex Desktop Streamable HTTP:

```json
{
  "mcpServers": {
    "windows-pc-1": {
      "url": "http://127.0.0.1:7332/mcp"
    }
  }
}
```

SSE:

```json
{
  "mcpServers": {
    "windows-pc-1-sse": {
      "url": "http://127.0.0.1:7332/sse"
    }
  }
}
```

If `COMPUTER_USE_WINDOWS_AUTH` is changed from `change.me`, configure the MCP client to send:

```text
Authorization: Bearer <token>
```

When `COMPUTER_USE_WINDOWS_HOST` is `0.0.0.0`, `COMPUTER_USE_WINDOWS_AUTH` must be changed from `change.me` before the server accepts requests. Do not expose `0.0.0.0` outside a trusted network.

## Environment

Config loading order:

- If package-root `.env` exists, values are read from that file.
- If package-root `.env` does not exist, system or launcher-provided environment variables are used.
- Missing values fall back to built-in defaults.

- `COMPUTER_USE_WINDOWS_HOST`
- `COMPUTER_USE_WINDOWS_PORT`
- `COMPUTER_USE_WINDOWS_AUTH`
- `COMPUTER_USE_WINDOWS_BLOCKED_APPS`
- `COMPUTER_USE_WINDOWS_FORCE_STOP_HOTKEY`

Runtime data is fixed to `<OS drive>:\Users\<username>\.computer-use-windows`.
Logs are written to `<OS drive>:\Users\<username>\.computer-use-windows\logs`.
Screenshots are written to `<OS drive>:\Users\<username>\.computer-use-windows\screenshots`.
Screenshots and volatile runtime folders are cleared when the server starts.

Other runtime subfolders:

- `traces`
- `terminal`
- `resources`
- `clipboard`

## Windows Native Requirements

Real mouse and keyboard actions use `node-interception`.

```powershell
npx node-interception /install
```

Run the driver install as administrator, reboot Windows, then restart the MCP server. Terminal tools use `@lydell/node-pty` and run with the same privilege level as the MCP server process.

The server uses Windows UI Automation for accessibility actions and Win32 APIs for window focus, movement, resizing, monitor geometry, and screenshots.

## Tools

- Observation and status: `computer_status`, `computer_observe`, `list_monitors`, `list_windows`, `focus_window`, `move_window`, `resize_window`, `observe_windows`, `get_window_accessibility`, `invoke_accessibility_action`, `calibrate_coordinates`
- Input: `computer_act`
- Apps and games: `search_apps`, `list_apps`, `run_app`
- Terminal: `terminal_open`, `terminal_write`, `terminal_read`, `terminal_resize`, `terminal_interrupt`, `terminal_close`
- Files: `file_exists`, `read_text_file`, `write_file`, `list_directory`, `reveal_in_explorer`
- Clipboard: `get_clipboard_text`, `set_clipboard_text`, `clear_clipboard`, `preserve_clipboard_begin`, `preserve_clipboard_end`
- Human takeover: `pause_session`, `resume_session`, `cancel_current_action`, `emergency_stop`, `request_user_approval`
- Logs and traces: `export_trace`, `replay_trace`, `get_last_actions`, `list_logs`, `read_log`, `search_logs`

Large screenshots, logs, terminal output, file reads, app catalogs, traces, and accessibility trees are returned as MCP resources.

## First Validation

1. Call `computer_status`.
2. Call `computer_observe`.
3. Inspect the screenshot resource, focused window, monitors, cursor, accessibility preview, and observation token.
4. Use the returned observation token with `computer_act`.
5. Use `search_apps` before `list_apps`.
6. Open a terminal with `terminal_open`, read output with `terminal_read`, then close it.
7. Exercise file and clipboard tools in a temporary folder.
8. Use `export_trace`, `list_logs`, `read_log`, and `search_logs` after actions.
9. Use `emergency_stop` if input is stuck.

The server refuses to continue through detected CAPTCHA, MFA, password manager, banking, payment, or unknown security prompts. Use `request_user_approval` or `pause_session` for those cases.
