import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY, ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { writePlan } from '../usecases/write-plan.ts';
import { approvePlan } from '../usecases/approve-plan.ts';
import { MaestroError } from '../lib/errors.ts';

export function registerPlanTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_plan_write',
    {
      description:
        'Write or update the plan for a feature. Plan must include a ## Discovery section (min 100 chars). ' +
        'Also include ## Non-Goals and ## Ghost Diffs sections.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        content: z.string().describe('Full plan content in markdown'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const result = await writePlan(services, feature, input.content);
      return respond({ ...result });
    }),
  );

  server.registerTool(
    'maestro_plan_read',
    {
      description: 'Read the plan and any review comments for a feature.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);

      const plan = services.planAdapter.read(feature);
      if (!plan) {
        throw new MaestroError(`No plan found for feature '${feature}'`, ['Write a plan with maestro_plan_write']);
      }

      return respond({ feature, plan });
    }),
  );

  server.registerTool(
    'maestro_plan_approve',
    {
      description: 'Approve the plan for execution. Address all review comments first.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const result = await approvePlan(services, feature);
      return respond({ ...result });
    }),
  );

  server.registerTool(
    'maestro_plan_comment',
    {
      description: 'Add a review comment to the plan. Used during plan review to flag issues or suggestions.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        body: z.string().describe('Comment text'),
        line: z.number().optional().describe('Line number in the plan this comment refers to'),
        author: z.string().optional().describe('Comment author name'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const comment = services.planAdapter.addComment(feature, {
        body: input.body,
        line: input.line ?? 0,
        author: input.author ?? 'agent',
      });
      return respond({ feature, comment });
    }),
  );
}
