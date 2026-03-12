/**
 * check-status use case.
 * Composite query: tasks, features, plan, context, runnable/blocked.
 */

import type { TaskPort } from '../ports/tasks.ts';
import type { FsFeatureAdapter } from '../adapters/fs-feature.ts';
import type { FsPlanAdapter } from '../adapters/fs-plan.ts';
import type { FsContextAdapter } from '../adapters/fs-context.ts';
import { countTaskStatuses, getNextAction } from '../utils/workflow.ts';
import type { TaskInfo, FeatureStatusType, PlanComment } from '../types.ts';

export interface StatusResult {
  feature: {
    name: string;
    status: FeatureStatusType;
  };
  plan: {
    exists: boolean;
    approved: boolean;
    commentCount: number;
    comments: PlanComment[];
  };
  tasks: {
    total: number;
    pending: number;
    inProgress: number;
    done: number;
    items: TaskInfo[];
  };
  runnable: string[];
  blocked: Record<string, string[]>;
  context: {
    count: number;
    totalChars: number;
  };
  nextAction: string;
}

export async function checkStatus(
  taskPort: TaskPort,
  featureAdapter: FsFeatureAdapter,
  planAdapter: FsPlanAdapter,
  contextAdapter: FsContextAdapter,
  featureName: string,
): Promise<StatusResult> {
  const feature = featureAdapter.get(featureName);
  if (!feature) {
    throw new Error(`Feature '${featureName}' not found`);
  }

  const plan = planAdapter.read(featureName);
  const tasks = await taskPort.list(featureName, { includeAll: true });
  const runnable = await taskPort.getRunnable(featureName);
  const blocked = await taskPort.getBlocked(featureName);
  const contextStats = contextAdapter.stats(featureName);
  const comments = plan?.comments || [];

  const counts = countTaskStatuses(tasks);
  const runnableFolders = runnable.map(t => t.folder);

  const planStatus = plan ? (plan.status === 'approved' ? 'approved' : 'draft') : null;
  const nextAction = getNextAction(
    planStatus,
    tasks.map(t => ({ status: t.status, folder: t.folder })),
    runnableFolders,
  );

  return {
    feature: {
      name: feature.name,
      status: feature.status,
    },
    plan: {
      exists: !!plan,
      approved: plan?.status === 'approved',
      commentCount: comments.length,
      comments,
    },
    tasks: {
      total: tasks.length,
      ...counts,
      items: tasks,
    },
    runnable: runnableFolders,
    blocked,
    context: {
      count: contextStats.count,
      totalChars: contextStats.totalChars,
    },
    nextAction,
  };
}
