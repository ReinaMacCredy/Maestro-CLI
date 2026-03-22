import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY, ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { featureParam } from './_utils/params.ts';
import { writePlan } from '../usecases/write-plan.ts';
import { approvePlan } from '../usecases/approve-plan.ts';
import { MaestroError } from '../lib/errors.ts';
import { buildTransitionHint } from '../utils/playbook.ts';
import { extractPlanOutline } from '../utils/plan-parser.ts';

export function registerPlanTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_plan_write',
    {
      description:
        'Write or update the plan for a feature. Plan must include a ## Discovery section (min 100 chars). ' +
        'Also include ## Non-Goals and ## Ghost Diffs sections. ' +
        'Pass scaffold: true to write a plan template instead of real content.',
      inputSchema: {
        feature: featureParam(),
        content: z.string().optional().describe('Full plan content in markdown (not required when scaffold is true)'),
        scaffold: z.boolean().optional().default(false).describe('Write a plan template scaffold instead of real content'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      if (!input.scaffold && !input.content) {
        throw new MaestroError('content is required when scaffold is false', [
          'Provide content or set scaffold: true',
        ]);
      }
      const result = await writePlan(
        { ...services, memoryAdapter: services.memoryAdapter },
        feature, input.content ?? '', { scaffold: input.scaffold },
      );
      return respond({ ...result });
    }),
  );

  server.registerTool(
    'maestro_plan_read',
    {
      description: 'Read the plan and any review comments for a feature.',
      inputSchema: {
        feature: featureParam(),
        summary: z.boolean().optional().default(false).describe('Return outline only (preview, headings, commentCount)'),
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

      if (input.summary) {
        const { preview, headings } = extractPlanOutline(plan.content);
        return respond({
          feature,
          plan: { preview, headings, status: plan.status, commentCount: plan.comments.length },
        });
      }

      return respond({ feature, plan });
    }),
  );

  server.registerTool(
    'maestro_plan_approve',
    {
      description: 'Approve the plan for execution. Address all review comments first.',
      inputSchema: {
        feature: featureParam(),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const result = await approvePlan(services, feature);
      const hint = buildTransitionHint('plan_approve');
      return respond({ ...result, ...(hint && { transition: hint }) });
    }),
  );

  server.registerTool(
    'maestro_plan_comment',
    {
      description: 'Add a review comment to the plan. Used during plan review to flag issues or suggestions.',
      inputSchema: {
        feature: featureParam(),
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

  server.registerTool(
    'maestro_plan_revoke',
    {
      description: 'Revoke plan approval, returning the feature to planning stage. Fails if any tasks are actively being worked (claimed, review, or revision).',
      inputSchema: {
        feature: featureParam(),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);

      if (!services.planAdapter.isApproved(feature)) {
        throw new MaestroError(`Plan for '${feature}' is not approved`, [
          'Only approved plans can be revoked',
        ]);
      }

      // Block revocation if any tasks are actively being worked
      const allTasks = await services.taskPort.list(feature, { includeAll: true });
      const activeTasks = allTasks.filter(t =>
        t.status === 'claimed' || t.status === 'review' || t.status === 'revision',
      );
      if (activeTasks.length > 0) {
        const activeList = activeTasks.map(t => `${t.folder} [${t.status}]`).join(', ');
        throw new MaestroError(
          `Cannot revoke: ${activeTasks.length} task(s) are actively being worked`,
          [`Active tasks: ${activeList}`, 'Wait for active tasks to complete or block them first'],
        );
      }

      services.planAdapter.revokeApproval(feature);
      services.featureAdapter.updateStatus(feature, 'planning');
      return respond({ feature, revoked: true });
    }),
  );

  server.registerTool(
    'maestro_plan_comments_clear',
    {
      description: 'Clear all review comments from a plan. Useful after addressing all feedback.',
      inputSchema: {
        feature: featureParam(),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      services.planAdapter.clearComments(feature);
      return respond({ feature, cleared: true });
    }),
  );
}
