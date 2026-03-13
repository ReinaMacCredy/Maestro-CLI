import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, errorResponse } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY, ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { resolveFeature } from './_utils/resolve.ts';
import { syncPlan } from '../usecases/sync-plan.ts';
import { MaestroError } from '../lib/errors.ts';
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

        const result = await syncPlan(services, feature);
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

        const task = await services.taskPort.create(feature, input.title, {
          description: input.description,
          deps: input.deps,
        });
        return respond({ success: true, feature, task });
      } catch (err) {
        if (err instanceof MaestroError) {
          return errorResponse({ terminal: false, reason: 'maestro_error', error: err.message, suggestions: err.hints });
        }
        return errorResponse({ terminal: true, reason: 'unexpected_error', error: String(err) });
      }
    },
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

        const fields: UpdateFields = {};
        if (input.status !== undefined) fields.status = input.status as TaskStatusType;
        if (input.notes !== undefined) fields.notes = input.notes;

        const task = await services.taskPort.update(feature, input.task, fields);
        return respond({ success: true, feature, task });
      } catch (err) {
        if (err instanceof MaestroError) {
          return errorResponse({ terminal: false, reason: 'maestro_error', error: err.message, suggestions: err.hints });
        }
        return errorResponse({ terminal: true, reason: 'unexpected_error', error: String(err) });
      }
    },
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

        const opts: ListOpts = {};
        if (input.status !== undefined) opts.status = input.status as TaskStatusType;
        if (input.includeAll !== undefined) opts.includeAll = input.includeAll;
        const tasks = await services.taskPort.list(feature, opts);
        return respond({ success: true, feature, tasks, count: tasks.length });
      } catch (err) {
        if (err instanceof MaestroError) {
          return errorResponse({ terminal: false, reason: 'maestro_error', error: err.message, suggestions: err.hints });
        }
        return errorResponse({ terminal: true, reason: 'unexpected_error', error: String(err) });
      }
    },
  );
}
