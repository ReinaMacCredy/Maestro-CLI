/**
 * MCP tool for task brief -- full agent context as structured JSON.
 * Universal replacement for hook-based injection.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { featureParam, taskParam } from './_utils/params.ts';
import { taskBrief } from '../usecases/task-brief.ts';

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
        configAdapter: services.configAdapter,
        directory: services.directory,
        graphPort: services.graphPort,
        doctrinePort: services.doctrinePort,
      }, feature, input.task);
      return respond({ ...result });
    }),
  );
}
