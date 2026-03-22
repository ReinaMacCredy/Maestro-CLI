import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_MUTATING, ANNOTATIONS_READONLY } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { featureParam } from './_utils/params.ts';
import { completeFeature } from '../usecases/complete-feature.ts';
import { buildTransitionHint } from '../utils/playbook.ts';

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
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const result = services.featureAdapter.create(input.name, input.ticket);
      return respond({ feature: result });
    }),
  );

  server.registerTool(
    'maestro_feature_list',
    {
      description: 'List all features with their status. Shows which feature is currently active.',
      inputSchema: {},
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async () => {
      const services = thunk.get();
      const features = services.featureAdapter.list();
      const active = services.featureAdapter.getActive();
      return respond({
        features,
        active: active?.name ?? null,
      });
    }),
  );

  server.registerTool(
    'maestro_feature_complete',
    {
      description: 'Mark a feature as completed. All tasks must be done first.',
      inputSchema: {
        feature: featureParam(),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const result = await completeFeature(services, feature);
      const hint = buildTransitionHint('feature_complete');
      return respond({ ...result, ...(hint && { transition: hint }) });
    }),
  );
}
