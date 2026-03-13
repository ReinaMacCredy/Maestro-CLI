import type { FsPlanAdapter } from '../adapters/fs-plan.ts';
import type { FsFeatureAdapter } from '../adapters/fs-feature.ts';
import { MaestroError } from '../lib/errors.ts';

export interface ApprovePlanServices {
  planAdapter: FsPlanAdapter;
  featureAdapter: FsFeatureAdapter;
}

export interface ApprovePlanResult {
  feature: string;
  commentCount: number;
}

export async function approvePlan(
  services: ApprovePlanServices,
  featureName: string,
): Promise<ApprovePlanResult> {
  const { planAdapter, featureAdapter } = services;
  featureAdapter.requireActive(featureName);

  const plan = planAdapter.read(featureName);
  if (!plan) throw new MaestroError(`No plan found for feature '${featureName}'`);

  const comments = plan.comments || [];
  if (comments.length > 0) {
    throw new MaestroError(
      `Plan has ${comments.length} unresolved comment(s)`,
      ['Clear comments first: maestro plan-comments-clear --feature ' + featureName]
    );
  }

  planAdapter.approve(featureName);
  return { feature: featureName, commentCount: 0 };
}
