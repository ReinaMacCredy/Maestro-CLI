import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { featureParam } from './_utils/params.ts';
import { checkStatus } from '../usecases/check-status.ts';
import { detectResearchTools } from '../utils/research-tools.ts';
import { derivePipelineStage } from '../utils/workflow.ts';
import { buildPlaybook } from '../utils/playbook.ts';

export function registerStatusTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_status',
    {
      description: 'Get current feature status: pipeline stage, plan, tasks, next action. Call at session start.',
      inputSchema: {
        feature: featureParam(),
        verbose: z.boolean().optional().default(false).describe('Include researchTools in response'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);

      const result = await checkStatus(services, feature);
      const pipelineStage = derivePipelineStage({
        planExists: result.plan.exists,
        planApproved: result.plan.approved,
        taskTotal: result.tasks.total,
        taskDone: result.tasks.done,
        contextCount: result.context.count,
      });
      const researchTools = input.verbose ? detectResearchTools(services.directory) : undefined;

      const playbook = buildPlaybook(pipelineStage);

      // Strip heavy fields for MCP -- agents use task_list / plan_read for details
      const { items: _items, ...tasksSummary } = result.tasks;
      const { comments: _comments, ...planSummary } = result.plan;

      return respond({
        ...result,
        plan: planSummary,
        tasks: tasksSummary,
        pipelineStage,
        ...(input.verbose && { researchTools }),
        playbook,
        skills: { recommended: playbook.skills }, // backward compat
      });
    }),
  );
}
