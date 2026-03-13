import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY, ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { syncPlan } from '../usecases/sync-plan.ts';
import type { UpdateFields, ListOpts } from '../ports/tasks.ts';
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
    'maestro_task_create',
    {
      description: 'Manually create a task for a feature. Prefer maestro_tasks_sync for plan-driven task creation.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        title: z.string().describe('Task title'),
        description: z.string().optional().describe('Task description'),
        deps: z.array(z.string()).optional().describe('Task folder IDs this depends on'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const task = await services.taskPort.create(feature, input.title, {
        description: input.description,
        deps: input.deps,
      });
      return respond({ success: true, feature, task });
    }),
  );

  server.registerTool(
    'maestro_task_update',
    {
      description: 'Update a task status or add notes. Use for manual status changes outside the worktree workflow.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        task: z.string().describe('Task folder ID'),
        status: z.enum(['pending', 'in_progress', 'done', 'blocked', 'failed', 'partial', 'cancelled']).optional().describe('New task status'),
        notes: z.string().optional().describe('Notes to add to the task'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);

      const fields: UpdateFields = {};
      if (input.status !== undefined) fields.status = input.status as TaskStatusType;
      if (input.notes !== undefined) fields.notes = input.notes;

      const task = await services.taskPort.update(feature, input.task, fields);
      return respond({ success: true, feature, task });
    }),
  );

  server.registerTool(
    'maestro_task_list',
    {
      description: 'List tasks for a feature with their status. Shows dependency ordering and which tasks are runnable.',
      inputSchema: {
        feature: z.string().optional().describe('Feature name (defaults to active feature)'),
        status: z.enum(['pending', 'in_progress', 'done', 'blocked', 'failed', 'partial', 'cancelled']).optional().describe('Filter by status'),
        includeAll: z.boolean().optional().describe('Include cancelled/completed tasks'),
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
