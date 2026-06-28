export const instructions = `# computer-use-windows

Call computer_status first, then computer_observe before screen-coordinate actions.
Use fresh observation tokens. Use resources for large screenshots, logs, files, terminal output, app catalogs, and accessibility trees.
Default to one computer_act call per computer_observe token. After every action, inspect followUpObservation or pass a verification object that checks the expected focused window, title, or accessibility text before the next action.
Do not run planned client-side loops of clicks or keys without checking the state after each action.
Use computer_act_sequence only when a sequence is unavoidable. Every sequence step must include verification and the tool stops on the first mismatch.
Before computer_act on a window, call is_window_foreground with the target handle. Call focus_window only when isForeground is false.
Before computer_act, call computer_observe({ handles:[target], inlineImage:true }), inspect the screenshot, and verify focusedWindow.handle matches the target handle. If the screenshot or focused window does not match the target, stop.
For mouse actions, use only screenshot-local coordinates from the current target screenshot or accessibility nodes. Pass windowHandle, screenshotResourceId, and coordinateSpace:"screenshot". Never send raw desktop coordinates.
Use /mcp machine identity or SSE endpoint identity when multiple Windows computers are connected.
Use search_apps before list_apps. Use observe_windows when work spans multiple applications.
Use native input when human-like real mouse or keyboard behavior is needed. Use fast tools when direct OS or UI Automation control is safer.
Do not bypass CAPTCHA, MFA, password managers, banking, payment, or unknown security prompts. Use request_user_approval or pause_session.
After a failed action, read recovery guidance and call computer_observe again before retrying screen coordinates.
`;
