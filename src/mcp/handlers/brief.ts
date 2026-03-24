/**
 * MCP tool for task brief -- full agent context as structured JSON.
 * Universal replacement for hook-based injection.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from '../services-thunk.ts';
import { respond, withErrorHandling } from '../respond.ts';
import { ANNOTATIONS_MUTATING } from '../annotations.ts';
import { requireFeature } from './_resolve.ts';
import { featureParam, taskParam } from '../params.ts';
import { taskBrief } from '../../tasks/task-brief.ts';

export function registerBriefTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_task_brief',
    {
      description:
        'Get full agent context for a task: compiled spec, DCP-scored memories, doctrine, ' +
        'graph context, revision context, and worker rules. Call this to get everything ' +
        'needed to work on a task.',
      inputSchema: {
        feature: featureParam(),
        task: taskParam(),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const result = await taskBrief({
        taskPort: services.taskPort,
        featureAdapter: services.featureAdapter,
        memoryAdapter: services.memoryAdapter,
        settingsPort: services.settingsPort,
        directory: services.directory,
        graphPort: services.graphPort,
        doctrinePort: services.doctrinePort,
      }, feature, input.task);
      const guidance = services.agentToolsRegistry.assembleProtocol('code-intelligence') ?? undefined;
      return respond({ ...result, agentToolsGuidance: guidance });
    }),
  );
}
