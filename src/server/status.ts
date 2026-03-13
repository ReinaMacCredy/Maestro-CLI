import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { checkStatus } from '../usecases/check-status.ts';

export function registerStatusTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_status',
    {
      description:
        'Get the current feature status: plan state, task progress, runnable/blocked tasks, next action. ' +
        'Call this at session start to understand where you are.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);

      const result = await checkStatus(services, feature);

      const skills: { recommended: string[] } = { recommended: [] };
      if (!result.plan.exists) {
        skills.recommended.push('writing-plans', 'parallel-exploration', 'brainstorming');
      } else if (!result.plan.approved) {
        skills.recommended.push('writing-plans');
      } else if (result.tasks.total > 0) {
        skills.recommended.push('executing-plans', 'dispatching-parallel-agents');
      }

      return respond({
        success: true,
        ...result,
        skills,
        hint: skills.recommended.length > 0
          ? `Load recommended skills: ${skills.recommended.map(s => `maestro_skill('${s}')`).join(', ')}`
          : 'All skills loaded or no recommendations at this stage.',
      });
    }),
  );
}
