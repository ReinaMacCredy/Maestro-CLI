import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, errorResponse } from './_utils/respond.ts';
import { ANNOTATIONS_MUTATING, ANNOTATIONS_DESTRUCTIVE } from './_utils/annotations.ts';
import { resolveFeature } from './_utils/resolve.ts';
import { startTask } from '../usecases/start-task.ts';
import { commitTask } from '../usecases/commit-task.ts';
import { MaestroError } from '../lib/errors.ts';

export function registerWorktreeTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_worktree_start',
    {
      description:
        'Start a task in an isolated git worktree. Creates the worktree, updates task to in_progress, ' +
        'and returns a workerPromptPath with delegation instructions for spawning a worker agent.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        task: z.string().describe('Task folder ID'),
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

        const result = await startTask(
          { ...services, directory: services.directory },
          { feature, task: input.task },
        );
        return respond({ success: true, ...result });
      } catch (err) {
        if (err instanceof MaestroError) {
          return errorResponse({ terminal: false, reason: 'maestro_error', error: err.message, suggestions: err.hints });
        }
        return errorResponse({ terminal: true, reason: 'unexpected_error', error: String(err) });
      }
    },
  );

  server.registerTool(
    'maestro_worktree_create',
    {
      description:
        'Resume a blocked task. Creates a new worker in the same worktree with the decision that unblocks it. ' +
        'Previous progress is preserved.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        task: z.string().describe('Task folder ID'),
        continueFrom: z.literal('blocked').describe('Must be "blocked"'),
        decision: z.string().describe('Decision to unblock the task'),
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

        const result = await startTask(
          { ...services, directory: services.directory },
          { feature, task: input.task, continueFrom: input.continueFrom, decision: input.decision },
        );
        return respond({ success: true, ...result });
      } catch (err) {
        if (err instanceof MaestroError) {
          return errorResponse({ terminal: false, reason: 'maestro_error', error: err.message, suggestions: err.hints });
        }
        return errorResponse({ terminal: true, reason: 'unexpected_error', error: String(err) });
      }
    },
  );

  server.registerTool(
    'maestro_worktree_commit',
    {
      description:
        'Complete, block, or fail a task in its worktree. Commits changes and updates task status. ' +
        'For blocked status, include blockerReason and blockerRecommendation.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        task: z.string().describe('Task folder ID'),
        status: z.enum(['completed', 'blocked', 'failed', 'partial']).describe('Final task status'),
        summary: z.string().describe('Summary of work done'),
        blockerReason: z.string().optional().describe('Why the task is blocked (required if status is blocked)'),
        blockerRecommendation: z.string().optional().describe('Recommended resolution for the blocker'),
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

        const result = await commitTask(services, {
          feature,
          task: input.task,
          status: input.status,
          summary: input.summary,
          blockerReason: input.blockerReason,
          blockerRecommendation: input.blockerRecommendation,
        });
        return respond({ ...result, success: true });
      } catch (err) {
        if (err instanceof MaestroError) {
          return errorResponse({ terminal: false, reason: 'maestro_error', error: err.message, suggestions: err.hints });
        }
        return errorResponse({ terminal: true, reason: 'unexpected_error', error: String(err) });
      }
    },
  );

  server.registerTool(
    'maestro_worktree_discard',
    {
      description: 'Abort and discard a task worktree. Removes the worktree and resets task to pending.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        task: z.string().describe('Task folder ID'),
      },
      annotations: ANNOTATIONS_DESTRUCTIVE,
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

        await services.worktreeAdapter.remove(feature, input.task, true);
        await services.taskPort.update(feature, input.task, { status: 'pending' });
        return respond({ success: true, feature, task: input.task, status: 'pending' });
      } catch (err) {
        if (err instanceof MaestroError) {
          return errorResponse({ terminal: false, reason: 'maestro_error', error: err.message, suggestions: err.hints });
        }
        return errorResponse({ terminal: true, reason: 'unexpected_error', error: String(err) });
      }
    },
  );
}
