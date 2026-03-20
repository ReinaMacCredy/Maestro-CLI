import type { TaskPort } from '../ports/tasks.ts';
import type { FeaturePort } from '../ports/features.ts';
import type { MemoryPort } from '../ports/memory.ts';
import { MaestroError } from '../lib/errors.ts';
import type { FeatureJson } from '../types.ts';

export interface CompleteFeatureServices {
  taskPort: TaskPort;
  featureAdapter: FeaturePort;
  memoryAdapter: MemoryPort;
}

export interface CompleteFeatureResult {
  feature: FeatureJson;
  tasksSummary: { total: number; done: number };
  suggestPromote: string[];
}

export async function completeFeature(
  services: CompleteFeatureServices,
  featureName: string,
): Promise<CompleteFeatureResult> {
  const { taskPort, featureAdapter, memoryAdapter } = services;
  const feature = featureAdapter.get(featureName);
  if (!feature) throw new MaestroError(`Feature '${featureName}' not found`);
  if (feature.status === 'completed') throw new MaestroError(`Feature '${featureName}' is already completed`);

  const tasks = await taskPort.list(featureName, { includeAll: true });
  const done = tasks.filter(t => t.status === 'done').length;
  const incomplete = tasks.filter(t => t.status !== 'done');

  if (tasks.length === 0) {
    throw new MaestroError(
      'Cannot complete feature: no tasks exist',
      ['Create and complete tasks before marking the feature as done'],
    );
  }

  if (incomplete.length > 0) {
    const incompleteList = incomplete.map(t => `${t.folder} (${t.status})`).join(', ');
    const hints = ['Complete all tasks before completing the feature'];
    if (incomplete.some(t => t.status === 'review')) {
      hints.push('Tasks in review need task_accept or task_reject before completion');
    }
    if (incomplete.some(t => t.status === 'revision')) {
      hints.push('Tasks in revision need to be re-claimed and completed');
    }
    throw new MaestroError(
      `Cannot complete feature: ${incomplete.length} task(s) not done: ${incompleteList}`,
      hints,
    );
  }

  // Suggest promoting feature memories to global
  const featureMemories = memoryAdapter.list(featureName);
  const suggestPromote = featureMemories.map(m => m.name);

  const updated = featureAdapter.complete(featureName);
  return { feature: updated, tasksSummary: { total: tasks.length, done }, suggestPromote };
}
