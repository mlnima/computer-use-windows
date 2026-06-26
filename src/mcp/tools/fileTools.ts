import fs from 'node:fs';
import path from 'node:path';
import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RuntimeState } from '../../state';
import { assertCanMutate } from '../../state';
import { fileExists, listDirectory, readTextFile, revealInExplorer, writeFile } from '../../filesystem/files';
import { addTextResource } from '../../resources/store';
import { okResult, toolError } from '../toolResults';

const needsConfirmation = (filePath: string) => {
  const resolved = path.resolve(filePath).toLowerCase();
  return resolved.startsWith('c:\\windows') || resolved.includes('\\program files');
};

export const registerFileTools = (server: McpServer, state: RuntimeState) => {
  server.registerTool('file_exists', {
    description: 'Check whether a path exists.',
    inputSchema: { path: z.string() },
  }, async ({ path: filePath }) => okResult({ exists: fileExists(filePath), machineId: state.machineId, path: path.resolve(filePath) }));
  server.registerTool('read_text_file', {
    description: 'Read a bounded UTF-8 text file and return a resource for large output.',
    inputSchema: { maxBytes: z.number().optional(), path: z.string() },
  }, async ({ maxBytes, path: filePath }) => {
    const result = readTextFile(filePath, maxBytes);
    const resourceId = result.truncated
      ? addTextResource(state, path.basename(filePath), 'text/plain', fs.readFileSync(path.resolve(filePath), 'utf8'), 'filesystem')
      : null;
    return okResult({ ...result, machineId: state.machineId, path: path.resolve(filePath), resourceId });
  });
  server.registerTool('write_file', {
    description: 'Write one text file. Destructive system paths require explicit confirmation handling.',
    inputSchema: { content: z.string(), path: z.string(), requireConfirmation: z.boolean().optional() },
  }, async ({ content, path: filePath, requireConfirmation }) => {
    assertCanMutate(state);
    if (requireConfirmation || needsConfirmation(filePath)) {
      return toolError(new Error('Write requires confirmation.'), 'Call request_user_approval() before retrying without requireConfirmation.');
    }
    return okResult({ machineId: state.machineId, path: writeFile(filePath, content), writtenBytes: Buffer.byteLength(content) });
  });
  server.registerTool('list_directory', {
    description: 'List directory entries in bounded pages.',
    inputSchema: { cursor: z.number().optional(), limit: z.number().optional(), path: z.string() },
  }, async ({ cursor, limit, path: dirPath }) => {
    const page = listDirectory(dirPath, limit, cursor);
    const all = page.nextCursor === null ? null : listDirectory(dirPath, Number.MAX_SAFE_INTEGER, 0);
    return okResult({
      ...page,
      machineId: state.machineId,
      path: path.resolve(dirPath),
      resourceId: all ? addTextResource(state, `${path.basename(dirPath)}.json`, 'application/json', JSON.stringify(all.entries, null, 2), 'filesystem') : null,
    });
  });
  server.registerTool('reveal_in_explorer', {
    description: 'Reveal a path in Windows Explorer.',
    inputSchema: { path: z.string() },
  }, async ({ path: targetPath }) => {
    try { assertCanMutate(state); await revealInExplorer(targetPath); return okResult({ machineId: state.machineId, path: path.resolve(targetPath) }); }
    catch (error) { return toolError(error, 'Check file_exists() and retry with an existing path.'); }
  });
};
