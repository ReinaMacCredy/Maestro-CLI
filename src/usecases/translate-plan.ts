/**
 * translate-plan use case (flywheel-style plan-to-beads conversion).
 *
 * Like sync-plan but creates rich, self-contained beads via br instead of
 * thin task stubs. Each bead carries description, design notes, acceptance
 * criteria, and full context so agents never need to look back at the plan.
 *
 * Used when taskBackend === 'br'. Falls back to sync-plan for fs backend.
 */

import type { TaskPort } from '../ports/tasks.ts';
import type { PlanPort } from '../ports/plans.ts';
import { parseTasksFromPlan, validateDependencyGraph, resolveDependencies } from '../utils/plan-parser.ts';
import { buildBeadOpts } from '../utils/bead-builder.ts';
import { MaestroError } from '../lib/errors.ts';
import type { TasksSyncResult } from '../types.ts';

export interface TranslatePlanServices {
  taskPort: TaskPort;
  planAdapter: PlanPort;
}

export async function translatePlan(
  services: TranslatePlanServices,
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

  // Memory files deliberately omitted from bead descriptions.
  // The pre-agent hook handles memory injection via DCP at agent-spawn time,
  // so baking memories into beads would cause double injection.

  const existingTasks = await taskPort.list(featureName, { includeAll: true });
  const existingByFolder = new Map(existingTasks.map(t => [t.folder, t]));
  const parsedFolderSet = new Set(parsedTasks.map(p => p.folder));

  // Gather completed task summaries for context injection
  const completedTasks = existingTasks
    .filter(t => t.status === 'done' && t.summary)
    .map(t => ({ name: t.name, summary: t.summary! }));

  const result: TasksSyncResult = {
    created: [],
    removed: [],
    kept: [],
    manual: [],
  };

  // Handle existing tasks (same logic as sync-plan)
  for (const existing of existingTasks) {
    if (existing.origin === 'manual') {
      result.manual.push(existing.folder);
      continue;
    }

    if (existing.status === 'done' || existing.status === 'claimed') {
      result.kept.push(existing.folder);
      continue;
    }

    const stillInPlan = parsedFolderSet.has(existing.folder);
    if (!stillInPlan) {
      await taskPort.remove(featureName, existing.folder);
      result.removed.push(existing.folder);
    } else {
      result.kept.push(existing.folder);
    }
  }

  // Create rich beads from plan sections
  for (const parsedTask of parsedTasks) {
    if (existingByFolder.has(parsedTask.folder)) continue;

    const dependsOn = resolveDependencies(parsedTask, parsedTasks);

    const beadOpts = buildBeadOpts({
      featureName,
      task: parsedTask,
      planContent: plan.content,
      allTasks: parsedTasks,
      dependsOn,
      completedTasks,
    });

    const created = await taskPort.create(featureName, parsedTask.name, beadOpts);

    // Update folder to match actual assignment (br prefixes issue ID)
    parsedTask.folder = created.folder;

    result.created.push(created.folder);
  }

  return result;
}
