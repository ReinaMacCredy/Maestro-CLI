import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { checkStatus } from '../usecases/check-status.ts';
import { detectResearchTools } from '../utils/research-tools.ts';
import { derivePipelineStage } from '../utils/workflow.ts';

export function registerStatusTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_status',
    {
      description:
        'Get the current feature status: pipeline stage, plan state, task progress, runnable/blocked tasks, next action. ' +
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
      const pipelineStage = derivePipelineStage({
        planExists: result.plan.exists,
        planApproved: result.plan.approved,
        taskTotal: result.tasks.total,
        taskDone: result.tasks.done,
        contextCount: result.context.count,
      });
      const researchTools = detectResearchTools(services.directory);

      const skills: { recommended: string[] } = { recommended: [] };
      if (pipelineStage === 'discovery' || pipelineStage === 'research') {
        skills.recommended.push('maestro:design', 'maestro:parallel-exploration', 'maestro:brainstorming');
      } else if (pipelineStage === 'planning') {
        skills.recommended.push('maestro:design');
      } else if (pipelineStage === 'execution') {
        skills.recommended.push('maestro:implement', 'maestro:dispatching');
      }

      return respond({
        ...result,
        pipelineStage,
        researchTools,
        skills,
        hint: skills.recommended.length > 0
          ? `Load recommended skills: ${skills.recommended.map(s => `maestro_skill('${s}')`).join(', ')}`
          : 'All skills loaded or no recommendations at this stage.',
      });
    }),
  );
}
