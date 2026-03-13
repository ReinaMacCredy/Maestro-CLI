/**
 * sync-plan use case.
 * Parse plan.md via parseTasksFromPlan(), validate, diff against existing
 * tasks in TaskPort, create/close/addDependency as needed.
 */

import type { TaskPort } from '../ports/tasks.ts';
import type { FsPlanAdapter } from '../adapters/fs-plan.ts';
import { parseTasksFromPlan, validateDependencyGraph, resolveDependencies } from '../utils/plan-parser.ts';
import { buildSpecContent } from '../utils/spec-builder.ts';
import { MaestroError } from '../lib/errors.ts';
import type { TasksSyncResult } from '../types.ts';

export interface SyncPlanServices {
  taskPort: TaskPort;
  planAdapter: FsPlanAdapter;
}

export async function syncPlan(
  services: SyncPlanServices,
  featureName: string,
): Promise<TasksSyncResult> {
  const { taskPort, planAdapter } = services;
  const plan = planAdapter.read(featureName);
  if (!plan) throw new MaestroError(`No plan found for feature '${featureName}'`);
  if (plan.status !== 'approved') {
    throw new MaestroError(
      'Plan must be approved before syncing tasks',
      ['Run: maestro plan-approve --feature ' + featureName]
    );
  }

  const parsedTasks = parseTasksFromPlan(plan.content);
  validateDependencyGraph(parsedTasks, featureName);

  const existingTasks = await taskPort.list(featureName, { includeAll: true });
  const existingByFolder = new Map(existingTasks.map(t => [t.folder, t]));

  const result: TasksSyncResult = {
    created: [],
    removed: [],
    kept: [],
    manual: [],
  };

  // Handle existing tasks
  for (const existing of existingTasks) {
    if (existing.origin === 'manual') {
      result.manual.push(existing.folder);
      continue;
    }

    if (existing.status === 'done' || existing.status === 'in_progress') {
      result.kept.push(existing.folder);
      continue;
    }

    if (existing.status === 'cancelled') {
      await taskPort.close(featureName, existing.folder, 'cancelled');
      result.removed.push(existing.folder);
      continue;
    }

    const stillInPlan = parsedTasks.some(p => p.folder === existing.folder);
    if (!stillInPlan) {
      await taskPort.close(featureName, existing.folder, 'cancelled');
      result.removed.push(existing.folder);
    } else {
      result.kept.push(existing.folder);
    }
  }

  // Create new tasks from plan
  for (const parsedTask of parsedTasks) {
    if (existingByFolder.has(parsedTask.folder)) continue;

    const dependsOn = resolveDependencies(parsedTask, parsedTasks);

    const specContent = buildSpecContent({
      featureName,
      task: parsedTask,
      dependsOn,
      allTasks: parsedTasks,
      planContent: plan.content,
    });

    const created = await taskPort.create(featureName, parsedTask.name, {
      description: specContent,
      deps: dependsOn,
    });

    result.created.push(created.folder);
  }

  return result;
}
