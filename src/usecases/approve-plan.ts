import type { FsPlanAdapter } from '../adapters/fs-plan.ts';
import type { FsFeatureAdapter } from '../adapters/fs-feature.ts';
import { MaestroError } from '../lib/errors.ts';

export interface ApprovePlanResult {
  feature: string;
  commentCount: number;
}

export async function approvePlan(
  planAdapter: FsPlanAdapter,
  featureAdapter: FsFeatureAdapter,
  featureName: string,
): Promise<ApprovePlanResult> {
  const feature = featureAdapter.get(featureName);
  if (!feature) throw new MaestroError(`Feature '${featureName}' not found`);
  if (feature.status === 'completed') {
    throw new MaestroError(
      `Feature '${featureName}' is completed`,
      ['Completed features cannot be modified. Create a new feature.']
    );
  }

  const plan = planAdapter.read(featureName);
  if (!plan) throw new MaestroError(`No plan found for feature '${featureName}'`);

  const comments = planAdapter.getComments(featureName);
  if (comments.length > 0) {
    throw new MaestroError(
      `Plan has ${comments.length} unresolved comment(s)`,
      ['Clear comments first: maestro plan-comments-clear --feature ' + featureName]
    );
  }

  planAdapter.approve(featureName);
  return { feature: featureName, commentCount: 0 };
}
