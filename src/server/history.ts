import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY } from './_utils/annotations.ts';
import { limitParam } from './_utils/params.ts';
import { history } from '../usecases/history.ts';
import type { FeatureStatusType } from '../types.ts';

const FEATURE_STATUSES = ['planning', 'approved', 'executing', 'completed'] as const;

export function registerHistoryTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_history',
    {
      description: 'Show feature completion history with task stats and duration.',
      inputSchema: {
        limit: limitParam(10),
        status: z.enum(FEATURE_STATUSES).optional().describe('Filter by feature status'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input: { limit?: number; status?: FeatureStatusType }) => {
      const services = thunk.get();
      const result = await history(services, {
        limit: input.limit,
        status: input.status,
      });
      return respond({ ...result });
    }),
  );
}
