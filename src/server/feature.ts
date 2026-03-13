import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, errorResponse } from './_utils/respond.ts';
import { ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { resolveFeature } from './_utils/resolve.ts';
import { completeFeature } from '../usecases/complete-feature.ts';
import { MaestroError } from '../lib/errors.ts';

export function registerFeatureTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_feature_create',
    {
      description: 'Create a new feature. This sets up the feature directory and makes it the active feature.',
      inputSchema: {
        name: z.string().describe('Feature name'),
        ticket: z.string().optional().describe('Ticket reference'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    async (input) => {
      try {
        const services = thunk.get();
        const result = services.featureAdapter.create(input.name, input.ticket);
        return respond({ success: true, feature: result });
      } catch (err) {
        if (err instanceof MaestroError) {
          return errorResponse({ terminal: false, reason: 'maestro_error', error: err.message, suggestions: err.hints });
        }
        return errorResponse({ terminal: true, reason: 'unexpected_error', error: String(err) });
      }
    },
  );

  server.registerTool(
    'maestro_feature_complete',
    {
      description: 'Mark a feature as completed. All tasks must be done or cancelled first.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
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

        const result = await completeFeature(services, feature);
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
