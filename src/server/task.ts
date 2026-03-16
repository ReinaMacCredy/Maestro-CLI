import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY, ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { syncPlan } from '../usecases/sync-plan.ts';
import type { ListOpts } from '../ports/tasks.ts';
import type { TaskStatusType } from '../types.ts';

export function registerTaskTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_tasks_sync',
    {
      description:
        'Generate tasks from an approved plan. Parses the plan markdown, creates task folders, ' +
        'and sets up dependency ordering. Plan must be approved first.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const result = await syncPlan(services, feature);
      return respond({ success: true, ...result });
    }),
  );

  server.registerTool(
    'maestro_task_next',
    {
      description:
        'Return all runnable (unclaimed, dependencies met) tasks with compiled specs. ' +
        'Use this to find what to work on next.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const runnable = await services.taskPort.getRunnable(feature);

      const tasksWithSpecs = await Promise.all(
        runnable.map(async (task) => {
          const spec = await services.taskPort.readSpec(feature, task.folder);
          return { ...task, spec };
        })
      );

      return respond({ success: true, feature, tasks: tasksWithSpecs, count: tasksWithSpecs.length });
    }),
  );

  server.registerTool(
    'maestro_task_claim',
    {
      description:
        'Claim a task for an agent. Marks the task as taken (pending -> claimed). ' +
        'Rejects if already claimed or not pending.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        task: z.string().describe('Task folder ID'),
        agent_id: z.string().describe('Agent identifier claiming this task'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const task = await services.taskPort.claim(feature, input.task, input.agent_id);
      return respond({ success: true, feature, task });
    }),
  );

  server.registerTool(
    'maestro_task_done',
    {
      description:
        'Mark a claimed task as complete. Provide a summary of work done. ' +
        'Unlocks dependent tasks.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        task: z.string().describe('Task folder ID'),
        summary: z.string().describe('Summary of work completed'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const task = await services.taskPort.done(feature, input.task, input.summary);
      return respond({ success: true, feature, task });
    }),
  );

  server.registerTool(
    'maestro_task_block',
    {
      description:
        'Mark a task as blocked. Records the blocker reason and releases the claim.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        task: z.string().describe('Task folder ID'),
        reason: z.string().describe('Why the task is blocked'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const task = await services.taskPort.block(feature, input.task, input.reason);
      return respond({ success: true, feature, task });
    }),
  );

  server.registerTool(
    'maestro_task_unblock',
    {
      description:
        'Unblock a blocked task. Attaches the decision and returns to pending.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        task: z.string().describe('Task folder ID'),
        decision: z.string().describe('Decision or resolution for the blocker'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const task = await services.taskPort.unblock(feature, input.task, input.decision);
      return respond({ success: true, feature, task });
    }),
  );

  server.registerTool(
    'maestro_task_list',
    {
      description: 'List tasks for a feature with their status. Shows dependency ordering and which tasks are runnable.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        status: z.enum(['pending', 'claimed', 'done', 'blocked']).optional().describe('Filter by status'),
        includeAll: z.boolean().optional().describe('Include all tasks regardless of status'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);

      const opts: ListOpts = {};
      if (input.status !== undefined) opts.status = input.status as TaskStatusType;
      if (input.includeAll !== undefined) opts.includeAll = input.includeAll;
      const tasks = await services.taskPort.list(feature, opts);
      return respond({ success: true, feature, tasks, count: tasks.length });
    }),
  );
}
