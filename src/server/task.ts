import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY, ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { featureParam, taskParam } from './_utils/params.ts';
import { syncPlan } from '../usecases/sync-plan.ts';
import { translatePlan } from '../usecases/translate-plan.ts';
import type { ListOpts } from '../ports/tasks.ts';
import type { TaskStatusType } from '../types.ts';

export function registerTaskTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_tasks_sync',
    {
      description:
        'Generate tasks from an approved plan. Plan must be approved first.',
      inputSchema: {
        feature: featureParam(),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const config = services.configAdapter.get();
      const result = config.taskBackend === 'br'
        ? await translatePlan(services, feature)
        : await syncPlan(services, feature);
      return respond({ ...result });
    }),
  );

  server.registerTool(
    'maestro_task_next',
    {
      description:
        'Return runnable tasks (unclaimed, dependencies met). ' +
        'Includes compiled spec for the recommended (first) task only. Use task_claim to start it.',
      inputSchema: {
        feature: featureParam(),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const runnable = await services.taskPort.getRunnable(feature);

      // Metadata for all runnable tasks; compiled spec only for the recommended (first) task
      const tasks = runnable.map(({ folder, name, dependsOn }) => ({ folder, name, dependsOn }));
      const recommendedSpec = runnable.length > 0
        ? await services.taskPort.readSpec(feature, runnable[0].folder)
        : undefined;

      return respond({ feature, tasks, ...(recommendedSpec !== undefined && { recommendedSpec }) });
    }),
  );

  server.registerTool(
    'maestro_task_claim',
    {
      description: 'Claim a pending task for an agent.',
      inputSchema: {
        feature: featureParam(),
        task: taskParam(),
        agent_id: z.string().describe('Agent identifier claiming this task'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const task = await services.taskPort.claim(feature, input.task, input.agent_id);
      return respond({ feature, task });
    }),
  );

  server.registerTool(
    'maestro_task_done',
    {
      description: 'Mark a claimed task as complete. Provide a summary of work done.',
      inputSchema: {
        feature: featureParam(),
        task: taskParam(),
        summary: z.string().describe('Summary of work completed'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const task = await services.taskPort.done(feature, input.task, input.summary);
      return respond({ feature, task });
    }),
  );

  server.registerTool(
    'maestro_task_block',
    {
      description:
        'Mark a task as blocked. Records the blocker reason and releases the claim.',
      inputSchema: {
        feature: featureParam(),
        task: taskParam(),
        reason: z.string().describe('Why the task is blocked'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const task = await services.taskPort.block(feature, input.task, input.reason);
      return respond({ feature, task });
    }),
  );

  server.registerTool(
    'maestro_task_unblock',
    {
      description:
        'Unblock a blocked task. Attaches the decision and returns to pending.',
      inputSchema: {
        feature: featureParam(),
        task: taskParam(),
        decision: z.string().describe('Decision or resolution for the blocker'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const task = await services.taskPort.unblock(feature, input.task, input.decision);
      return respond({ feature, task });
    }),
  );

  server.registerTool(
    'maestro_task_list',
    {
      description: 'List tasks for a feature with their status. Shows dependency ordering and which tasks are runnable.',
      inputSchema: {
        feature: featureParam(),
        status: z.enum(['pending', 'claimed', 'done', 'blocked']).optional().describe('Filter by status'),
        includeAll: z.boolean().optional().describe('Include all tasks regardless of status'),
        brief: z.boolean().optional().default(false).describe('Return compact task info (folder, name, status, origin, dependsOn only)'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);

      // Warn if the feature doesn't exist
      const featureInfo = services.featureAdapter.get(feature);
      if (!featureInfo) {
        return respond({ feature, tasks: [], warning: `Feature '${feature}' not found` });
      }

      const opts: ListOpts = {};
      if (input.status !== undefined) opts.status = input.status as TaskStatusType;
      if (input.includeAll !== undefined) opts.includeAll = input.includeAll;
      const tasks = await services.taskPort.list(feature, opts);
      if (input.brief) {
        const compact = tasks.map(({ folder, name, status, origin, dependsOn }) => ({
          folder, name, status, origin, dependsOn,
        }));
        return respond({ feature, tasks: compact });
      }
      return respond({ feature, tasks });
    }),
  );
}
