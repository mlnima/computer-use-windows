import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RuntimeState } from '../state';
import { readResourceByUri } from '../resources/store';
import { instructions } from '../prompts/instructions';

export const registerResources = (server: McpServer, state: RuntimeState) => {
  server.registerResource(
    'runtime-status',
    'computer-use-windows://runtime-status',
    { mimeType: 'application/json', title: 'Runtime Status' },
    async (uri) => ({
      contents: [{ mimeType: 'application/json', text: JSON.stringify({
        emergencyStopped: state.emergencyStopped,
        machineId: state.machineId,
        paused: state.paused,
        preservedClipboard: state.preservedClipboard !== null,
        sessionId: state.sessionId,
        transport: state.transportMode,
      }, null, 2), uri: uri.href }],
    }),
  );
  server.registerResource(
    'instructions',
    'computer-use-windows://instructions',
    { mimeType: 'text/markdown', title: 'Instructions' },
    async (uri) => ({ contents: [{ mimeType: 'text/markdown', text: instructions, uri: uri.href }] }),
  );
  const registerRuntimeTemplate = (name: string, template: string, title: string) => {
    server.registerResource(name, new ResourceTemplate(template, { list: undefined }), { title }, async (uri) => {
      const resource = readResourceByUri(state, uri.href);
      if (!resource) throw new Error('Resource not found.');
      const common = { mimeType: resource.mimeType, uri: uri.href };
      return {
        contents: [resource.text
          ? { ...common, text: resource.text }
          : { ...common, blob: resource.bytes?.toString('base64') || '' }],
      };
    });
  };
  registerRuntimeTemplate('resources', 'computer-use-windows://resources/{id}', 'Runtime Resource');
  registerRuntimeTemplate('screenshots', 'computer-use-windows://screenshots/{id}', 'Screenshot Resource');
  registerRuntimeTemplate('traces', 'computer-use-windows://traces/{id}', 'Trace Resource');
  registerRuntimeTemplate('terminal', 'computer-use-windows://terminal/{terminalId}/{id}', 'Terminal Resource');
  registerRuntimeTemplate('filesystem', 'computer-use-windows://filesystem/{id}', 'Filesystem Resource');
  registerRuntimeTemplate('accessibility', 'computer-use-windows://accessibility/{id}', 'Accessibility Resource');
  registerRuntimeTemplate('apps', 'computer-use-windows://apps/{id}', 'App Catalog Resource');
  registerRuntimeTemplate('logs', 'computer-use-windows://logs/{id}', 'Log Resource');
  registerRuntimeTemplate('machines', 'computer-use-windows://machines/{id}', 'Machine Resource');
};
