import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, errorResponse } from './_utils/respond.ts';
import { ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { resolveFeature } from './_utils/resolve.ts';
import { mergeTask } from '../usecases/merge-task.ts';
import { MaestroError } from '../lib/errors.ts';

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
    async (input) => {
      try {
        const services = thunk.get();
        const feature = resolveFeature(services, input.feature);
        if (!feature) {
          return errorResponse({
            terminal: false,
            reason: 'no_feature',
            error: 'No active feature found',
            suggestions: ['Specify a feature name or create one with maestro_feature_create'],
          });
        }

        const result = await mergeTask(services, {
          feature,
          task: input.task,
          strategy: input.strategy,
        });
        return respond({ success: true, ...result });
      } catch (err) {
        if (err instanceof MaestroError) {
          return errorResponse({ terminal: false, reason: 'maestro_error', error: err.message, suggestions: err.hints });
        }
        return errorResponse({ terminal: true, reason: 'unexpected_error', error: String(err) });
      }
    },
  );
}
