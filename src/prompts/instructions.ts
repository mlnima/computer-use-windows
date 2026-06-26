export const instructions = `# computer-use-windows

Call computer_status first, then computer_observe before screen-coordinate actions.
Use fresh observation tokens. Use resources for large screenshots, logs, files, terminal output, app catalogs, and accessibility trees.
Use /mcp machine identity or SSE endpoint identity when multiple Windows computers are connected.
Use search_apps before list_apps. Use observe_windows when work spans multiple applications.
Use native input when human-like real mouse or keyboard behavior is needed. Use fast tools when direct OS or UI Automation control is safer.
Do not bypass CAPTCHA, MFA, password managers, banking, payment, or unknown security prompts. Use request_user_approval or pause_session.
After a failed action, read recovery guidance and call computer_observe again before retrying screen coordinates.
`;
