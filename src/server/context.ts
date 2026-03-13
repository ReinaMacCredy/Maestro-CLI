import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, errorResponse } from './_utils/respond.ts';
import { ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { resolveFeature } from './_utils/resolve.ts';
import { MaestroError } from '../lib/errors.ts';

export function registerContextTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_context_write',
    {
      description:
        'Save context, decisions, or research findings for a feature. ' +
        'Use during discovery to persist information across sessions.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        name: z.string().describe('Context file name'),
        content: z.string().describe('Context content to save'),
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

        const path = services.contextAdapter.write(feature, input.name, input.content);
        return respond({ success: true, feature, name: input.name, path });
      } catch (err) {
        if (err instanceof MaestroError) {
          return errorResponse({ terminal: false, reason: 'maestro_error', error: err.message, suggestions: err.hints });
        }
        return errorResponse({ terminal: true, reason: 'unexpected_error', error: String(err) });
      }
    },
  );
}
