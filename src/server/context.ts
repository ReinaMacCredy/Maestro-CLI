import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';

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
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const path = services.contextAdapter.write(feature, input.name, input.content);
      return respond({ success: true, feature, name: input.name, path });
    }),
  );
}
