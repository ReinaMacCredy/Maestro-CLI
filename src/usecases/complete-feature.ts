import type { TaskPort } from '../ports/tasks.ts';
import type { FeaturePort } from '../ports/features.ts';
import { MaestroError } from '../lib/errors.ts';
import type { FeatureJson } from '../types.ts';

export interface CompleteFeatureServices {
  taskPort: TaskPort;
  featureAdapter: FeaturePort;
}

export interface CompleteFeatureResult {
  feature: FeatureJson;
  tasksSummary: { total: number; done: number; cancelled: number };
}

export async function completeFeature(
  services: CompleteFeatureServices,
  featureName: string,
): Promise<CompleteFeatureResult> {
  const { taskPort, featureAdapter } = services;
  const feature = featureAdapter.get(featureName);
  if (!feature) throw new MaestroError(`Feature '${featureName}' not found`);
  if (feature.status === 'completed') throw new MaestroError(`Feature '${featureName}' is already completed`);

  const tasks = await taskPort.list(featureName, { includeAll: true });
  const done = tasks.filter(t => t.status === 'done').length;
  const cancelled = tasks.filter(t => t.status === 'cancelled').length;
  const incomplete = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');

  if (incomplete.length > 0) {
    const incompleteList = incomplete.map(t => `${t.folder} (${t.status})`).join(', ');
    throw new MaestroError(
      `Cannot complete feature: ${incomplete.length} task(s) not done/cancelled: ${incompleteList}`,
      ['Complete or cancel all tasks before completing the feature']
    );
  }

  const updated = featureAdapter.complete(featureName);
  return { feature: updated, tasksSummary: { total: tasks.length, done, cancelled } };
}
