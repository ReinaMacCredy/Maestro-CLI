import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY, ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { featureParam, taskParam } from './_utils/params.ts';
import { syncPlan } from '../usecases/sync-plan.ts';
import { translatePlan } from '../usecases/translate-plan.ts';
import { verifyTask } from '../usecases/verify-task.ts';
import { resolveVerificationConfig } from '../utils/verification-config.ts';
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
      const tasks = runnable.map(({ folder, name, status, dependsOn }) => ({ folder, name, status, dependsOn }));
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
      description: 'Mark a claimed task as complete. Runs verification checks against spec and acceptance criteria. If checks fail, task enters review state.',
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
      const config = services.configAdapter.get();
      const vConfig = resolveVerificationConfig(config.verification);

      const result = await verifyTask(
        services.taskPort, services.verificationPort,
        services.memoryAdapter, vConfig,
        services.directory, feature, input.task, input.summary,
      );

      if (result.newStatus === 'done') {
        return respond({ feature, task: result.task, verification: result.report });
      }

      // Verification failed -- task is in 'review' state
      const currentTask = await services.taskPort.get(feature, input.task);
      const revisionCount = currentTask?.revisionCount ?? 0;

      if (vConfig.autoReject && revisionCount >= vConfig.maxRevisions) {
        // Max revisions reached -- force-accept
        const acceptedTask = await services.taskPort.done(feature, input.task, input.summary);
        services.memoryAdapter.write(feature, `verification-auto-accept-${input.task}`,
          `---\ntags: [verification, auto-accept]\ncategory: debug\npriority: 1\n---\n\nTask ${input.task} auto-accepted after ${vConfig.maxRevisions} revision(s). Score: ${result.report.score.toFixed(2)}`);
        return respond({
          feature, task: acceptedTask, verification: result.report,
          warning: `Auto-accepted after ${vConfig.maxRevisions} revision(s) with score ${result.report.score.toFixed(2)}`,
        });
      }

      if (vConfig.autoReject) {
        // Auto-transition review -> revision
        const feedback = result.report.suggestions.join('; ') || 'Verification failed';
        const revisionTask = await services.taskPort.revision(
          feature, input.task, feedback, revisionCount + 1,
        );
        return respond({
          feature, task: revisionTask, verification: result.report,
          status: 'revision', message: `Verification failed (score: ${result.report.score.toFixed(2)}). Task sent to revision.`,
        });
      }

      // Manual review -- orchestrator decides
      return respond({
        feature, task: result.task, verification: result.report,
        status: 'review', message: `Verification failed (score: ${result.report.score.toFixed(2)}). Use task_accept or task_reject.`,
      });
    }),
  );

  server.registerTool(
    'maestro_task_accept',
    {
      description: 'Accept a task in review state, overriding failed verification. Transitions review -> done.',
      inputSchema: {
        feature: featureParam(),
        task: taskParam(),
        summary: z.string().optional().describe('Override summary (uses existing if omitted)'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const existing = await services.taskPort.get(feature, input.task);
      if (!existing || existing.status !== 'review') {
        throw new Error(`Task '${input.task}' is not in review state (current: ${existing?.status ?? 'not found'})`);
      }
      const summary = input.summary ?? existing.summary ?? '';
      const task = await services.taskPort.done(feature, input.task, summary);
      return respond({ feature, task, message: 'Task accepted (verification override)' });
    }),
  );

  server.registerTool(
    'maestro_task_reject',
    {
      description: 'Reject a task in review state and send for revision. Transitions review -> revision with feedback.',
      inputSchema: {
        feature: featureParam(),
        task: taskParam(),
        feedback: z.string().describe('Feedback for the revision -- what needs to change'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const existing = await services.taskPort.get(feature, input.task);
      if (!existing || existing.status !== 'review') {
        throw new Error(`Task '${input.task}' is not in review state (current: ${existing?.status ?? 'not found'})`);
      }
      const revisionCount = (existing.revisionCount ?? 0) + 1;
      const task = await services.taskPort.revision(feature, input.task, input.feedback, revisionCount);
      return respond({ feature, task, message: `Task sent for revision (attempt ${revisionCount})` });
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
        status: z.enum(['pending', 'claimed', 'done', 'blocked', 'review', 'revision']).optional().describe('Filter by status'),
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
