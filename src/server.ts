/**
 * MCP server entry point for maestro.
 * Lazy service initialization -- starts without .maestro/ existing.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServicesThunk } from './server/_utils/services-thunk.ts';
import { registerStatusTools } from './server/status.ts';
import { registerFeatureTools } from './server/feature.ts';
import { registerPlanTools } from './server/plan.ts';
import { registerTaskTools } from './server/task.ts';
import { registerMemoryTools } from './server/memory.ts';
import { registerSkillTools } from './server/skill.ts';
import { registerInitTools } from './server/init.ts';
import { registerGraphTools } from './server/graph.ts';
import { registerHandoffTools } from './server/handoff.ts';
import { registerSearchTools } from './server/search.ts';
import { registerPingTools } from './server/ping.ts';
import { registerDcpTools } from './server/dcp.ts';
import { registerExecutionInsightsTools } from './server/execution-insights.ts';
import { registerDoctrineTools } from './server/doctrine.ts';
import { registerBriefTools } from './server/brief.ts';
import { VERSION } from './version.ts';
import { checkCli } from './lib/cli-detect.ts';

export function createMaestroServer(directory: string): McpServer {
  const server = new McpServer({
    name: 'maestro',
    version: VERSION,
  });

  const thunk = createServicesThunk(directory);

  registerStatusTools(server, thunk);
  registerFeatureTools(server, thunk);
  registerPlanTools(server, thunk);
  registerTaskTools(server, thunk);
  registerMemoryTools(server, thunk);
  registerSkillTools(server, thunk, directory);
  registerInitTools(server, thunk, directory);
  registerHandoffTools(server, thunk);
  registerPingTools(server, thunk);
  registerDcpTools(server, thunk);
  registerExecutionInsightsTools(server, thunk);
  registerDoctrineTools(server, thunk);
  registerBriefTools(server, thunk);

  // Conditional: only register graph/search tools when CLIs are available
  if (checkCli('bv')) registerGraphTools(server, thunk);
  if (checkCli('cass')) registerSearchTools(server, thunk);

  return server;
}

export async function main() {
  const directory = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const server = createMaestroServer(directory);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only auto-start when run directly, not when imported by start.mjs
const isBunDirect = typeof Bun !== 'undefined' && Bun.main === Bun.resolveSync(import.meta.path, '.');
if (isBunDirect) {
  main().catch((err) => {
    console.error('[maestro] Server failed to start:', err);
    process.exit(1);
  });
}
