/**
 * Task dependency checking for maestroCLI.
 */

import { buildEffectiveDependencies } from './dependency.ts';
import type { TaskPort } from '../port.ts';
import { isDependencySatisfied } from '../transitions.ts';
import type { TaskInfo } from '../../core/types.ts';

/**
 * Check if a task's dependencies are satisfied.
 */
export async function checkDependencies(
  taskPort: TaskPort,
  feature: string,
  taskFolder: string,
  existingTasks?: TaskInfo[],
): Promise<{ allowed: true; error?: undefined } | { allowed: false; error: string }> {
  const tasks = existingTasks ?? await taskPort.list(feature, { includeAll: true });

  const tasksWithDeps = tasks.map(task => ({
    folder: task.folder,
    status: task.status,
    dependsOn: task.dependsOn,
  }));

  const effectiveDeps = buildEffectiveDependencies(tasksWithDeps);
  const deps = effectiveDeps.get(taskFolder) ?? [];

  if (deps.length === 0) {
    return { allowed: true };
  }

  const statusByFolder = new Map(tasks.map(t => [t.folder, t.status]));
  const unmetDeps: Array<{ folder: string; status: string }> = [];

  for (const depFolder of deps) {
    const depStatus = statusByFolder.get(depFolder);
    if (!depStatus || !isDependencySatisfied(depStatus)) {
      unmetDeps.push({ folder: depFolder, status: depStatus ?? 'unknown' });
    }
  }

  if (unmetDeps.length > 0) {
    const depList = unmetDeps
      .map(d => `"${d.folder}" (${d.status})`)
      .join(', ');

    return {
      allowed: false,
      error: `Dependency constraint: Task "${taskFolder}" cannot start - dependencies not done: ${depList}. ` +
        `Only tasks with status 'done' satisfy dependencies.`,
    };
  }

  return { allowed: true };
}
