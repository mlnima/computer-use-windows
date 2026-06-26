import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ServerConfig } from '../config';
import { createComputerUseServer } from './createServer';

export const startStdio = async (config: ServerConfig) => {
  const { server } = createComputerUseServer(config, 'stdio');
  await server.connect(new StdioServerTransport());
};
