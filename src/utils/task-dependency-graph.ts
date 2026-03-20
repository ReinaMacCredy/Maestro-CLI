/**
 * Task dependency graph computation for maestroCLI.
 * Forked from hive-core/src/services/taskDependencyGraph.ts -- direct copy.
 */

import type { TaskStatusType } from '../types.ts';

export interface TaskWithDeps {
  folder: string;
  status: TaskStatusType;
  dependsOn?: string[];
}

export interface RunnableBlockedResult {
  runnable: string[];
  blocked: Record<string, string[]>;
}

export function computeRunnableAndBlocked(tasks: TaskWithDeps[]): RunnableBlockedResult {
  const statusByFolder = new Map<string, TaskStatusType>();
  for (const task of tasks) {
    statusByFolder.set(task.folder, task.status);
  }

  const runnable: string[] = [];
  const blocked: Record<string, string[]> = {};

  const effectiveDepsByFolder = buildEffectiveDependencies(tasks);

  for (const task of tasks) {
    // Both pending and revision tasks are candidates for runnable
    if (task.status !== 'pending' && task.status !== 'revision') {
      continue;
    }

    const deps = effectiveDepsByFolder.get(task.folder) ?? [];

    const unmetDeps = deps.filter(dep => {
      const depStatus = statusByFolder.get(dep);
      // Both done and review satisfy dependencies
      return depStatus !== 'done' && depStatus !== 'review';
    });

    if (unmetDeps.length === 0) {
      runnable.push(task.folder);
    } else {
      blocked[task.folder] = unmetDeps;
    }
  }

  return { runnable, blocked };
}

export function buildEffectiveDependencies(tasks: TaskWithDeps[]): Map<string, string[]> {
  const orderByFolder = new Map<string, number | null>();
  const folderByOrder = new Map<number, string>();

  for (const task of tasks) {
    const match = task.folder.match(/^(\d+)-/);
    if (!match) {
      orderByFolder.set(task.folder, null);
      continue;
    }

    const order = parseInt(match[1], 10);
    orderByFolder.set(task.folder, order);
    if (!folderByOrder.has(order)) {
      folderByOrder.set(order, task.folder);
    }
  }

  const effectiveDeps = new Map<string, string[]>();

  for (const task of tasks) {
    if (task.dependsOn !== undefined) {
      effectiveDeps.set(task.folder, task.dependsOn);
      continue;
    }

    const order = orderByFolder.get(task.folder);
    if (!order || order <= 1) {
      effectiveDeps.set(task.folder, []);
      continue;
    }

    const previousFolder = folderByOrder.get(order - 1);
    effectiveDeps.set(task.folder, previousFolder ? [previousFolder] : []);
  }

  return effectiveDeps;
}
