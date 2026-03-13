/**
 * MCP server entry point for maestro.
 * Lazy service initialization -- starts without .maestro/ existing.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServicesThunk, type ServicesThunk } from './server/_utils/services-thunk.ts';
import { registerStatusTools } from './server/status.ts';
import { registerFeatureTools } from './server/feature.ts';
import { registerPlanTools } from './server/plan.ts';
import { registerTaskTools } from './server/task.ts';
import { registerWorktreeTools } from './server/worktree.ts';
import { registerMergeTools } from './server/merge.ts';
import { registerContextTools } from './server/context.ts';
import { registerSkillTools } from './server/skill.ts';
import { registerInitTools } from './server/init.ts';

export function createMaestroServer(directory: string): McpServer {
  const server = new McpServer({
    name: 'maestro',
    version: '0.2.0',
  });

  const thunk = createServicesThunk(directory);

  registerStatusTools(server, thunk);
  registerFeatureTools(server, thunk);
  registerPlanTools(server, thunk);
  registerTaskTools(server, thunk);
  registerWorktreeTools(server, thunk);
  registerMergeTools(server, thunk);
  registerContextTools(server, thunk);
  registerSkillTools(server, thunk, directory);
  registerInitTools(server, thunk, directory);

  return server;
}

export async function main() {
  const directory = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const server = createMaestroServer(directory);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Direct execution
main().catch((err) => {
  console.error('[maestro] Server failed to start:', err);
  process.exit(1);
});
