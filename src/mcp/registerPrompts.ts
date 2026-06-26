import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { instructions } from '../prompts/instructions';

export const registerPrompts = (server: McpServer) => {
  server.registerPrompt(
    'computer-use-windows',
    { description: 'Instructions for controlling a Windows computer through this MCP.' },
    async () => ({
      messages: [{ content: { text: instructions, type: 'text' }, role: 'user' }],
    }),
  );
};
