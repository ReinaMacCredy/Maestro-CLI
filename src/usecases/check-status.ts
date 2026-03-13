/**
 * check-status use case.
 * Composite query: tasks, features, plan, context, runnable/blocked.
 */

import type { TaskPort } from '../ports/tasks.ts';
import type { FeaturePort } from '../ports/features.ts';
import type { PlanPort } from '../ports/plans.ts';
import type { ContextPort } from '../ports/context.ts';
import type { WorktreePort } from '../ports/worktree.ts';
import { countTaskStatuses, getNextAction } from '../utils/workflow.ts';
import type { TaskInfo, FeatureStatusType, PlanComment } from '../types.ts';

export interface StatusServices {
  taskPort: TaskPort;
  featureAdapter: FeaturePort;
  planAdapter: PlanPort;
  contextAdapter: ContextPort;
  worktreeAdapter?: WorktreePort;
}

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
  zombies: string[];
  context: {
    count: number;
    totalBytes: number;
  };
  nextAction: string;
}

export async function checkStatus(
  services: StatusServices,
  featureName: string,
): Promise<StatusResult> {
  const { taskPort, featureAdapter, planAdapter, contextAdapter, worktreeAdapter } = services;
  const feature = featureAdapter.get(featureName);
  if (!feature) {
    throw new Error(`Feature '${featureName}' not found`);
  }

  const plan = planAdapter.read(featureName);
  const [tasks, runnable, blocked] = await Promise.all([
    taskPort.list(featureName, { includeAll: true }),
    taskPort.getRunnable(featureName),
    taskPort.getBlocked(featureName),
  ]);
  const contextStats = contextAdapter.stats(featureName);
  const comments = plan?.comments || [];

  // Detect zombie tasks: in_progress but worktree no longer exists
  let zombies: string[] = [];
  if (worktreeAdapter) {
    const inProgress = tasks.filter(t => t.status === 'in_progress');
    const checks = await Promise.all(
      inProgress.map(async (t) => {
        const wt = await worktreeAdapter.get(featureName, t.folder);
        return wt ? null : t.folder;
      }),
    );
    zombies = checks.filter((f): f is string => f !== null);
  }

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
    zombies,
    context: {
      count: contextStats.count,
      totalBytes: contextStats.totalBytes,
    },
    nextAction,
  };
}
