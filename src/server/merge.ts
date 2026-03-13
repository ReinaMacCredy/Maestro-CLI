import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { mergeTask } from '../usecases/merge-task.ts';

export function registerMergeTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_merge',
    {
      description: 'Merge a completed task branch into main. Task must have status done/completed.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        task: z.string().describe('Task folder ID'),
        strategy: z.enum(['merge', 'squash', 'rebase']).optional().default('merge').describe('Merge strategy (default: merge)'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const result = await mergeTask(services, {
        feature,
        task: input.task,
        strategy: input.strategy,
      });
      return respond({ success: true, ...result });
    }),
  );
}
