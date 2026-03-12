/**
 * Feature resolution utilities for maestroCLI.
 * Forked from hive-core/src/utils/feature-resolution.ts.
 * Adapted: TaskService -> TaskPort for checkDependencies.
 */

import * as path from 'path';
import * as fs from 'fs';
import { detectContext, listFeatures } from './detection.ts';
import { buildEffectiveDependencies } from './task-dependency-graph.ts';
import type { TaskPort } from '../ports/tasks.ts';

export function resolveFeature(directory: string, explicit?: string): string | null {
  if (explicit) return explicit;

  const context = detectContext(directory);
  if (context.feature) return context.feature;

  const features = listFeatures(directory);
  if (features.length === 1) return features[0];

  return null;
}

export function checkBlocked(directory: string, feature: string): string | null {
  const blockedPath = path.join(directory, '.hive', 'features', feature, 'BLOCKED');
  try {
    const reason = fs.readFileSync(blockedPath, 'utf-8').trim();
    return `BLOCKED by Beekeeper

${reason || '(No reason provided)'}

The human has blocked this feature. Wait for them to unblock it.
To unblock: Remove .hive/features/${feature}/BLOCKED`;
  } catch {
    return null;
  }
}

/**
 * Check if a task's dependencies are satisfied.
 * Adapted: uses TaskPort instead of TaskService.
 */
export async function checkDependencies(
  taskPort: TaskPort,
  feature: string,
  taskFolder: string,
): Promise<{ allowed: true; error?: undefined } | { allowed: false; error: string }> {
  const tasks = await taskPort.list(feature, { includeAll: true });

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
    const depStatus = statusByFolder.get(depFolder) ?? 'unknown';
    if (depStatus !== 'done') {
      unmetDeps.push({ folder: depFolder, status: depStatus });
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

export function sanitizeName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Name must be a non-empty string');
  }

  let sanitized = name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\-_.]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

  if (sanitized.length > 128) {
    sanitized = sanitized.slice(0, 128).replace(/[-.]+$/, '');
  }

  if (!sanitized) {
    throw new Error(`Name "${name}" produces an empty result after sanitization`);
  }

  return sanitized;
}
