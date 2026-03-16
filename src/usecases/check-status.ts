/**
 * check-status use case.
 * Composite query for feature, plan, tasks, and context.
 */

import type { TaskPort } from '../ports/tasks.ts';
import type { FeaturePort } from '../ports/features.ts';
import type { PlanPort } from '../ports/plans.ts';
import type { ContextPort } from '../ports/context.ts';
import { countTaskStatuses, getNextAction } from '../utils/workflow.ts';
import type { TaskInfo, FeatureStatusType, PlanComment } from '../types.ts';

export interface StatusServices {
  taskPort: TaskPort;
  featureAdapter: FeaturePort;
  planAdapter: PlanPort;
  contextAdapter: ContextPort;
  directory: string;
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
  blocked: string[];
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
  const { taskPort, featureAdapter, planAdapter, contextAdapter } = services;
  const feature = featureAdapter.get(featureName);
  if (!feature) {
    throw new Error(`Feature '${featureName}' not found`);
  }

  const plan = planAdapter.read(featureName);
  const [tasks, runnable] = await Promise.all([
    taskPort.list(featureName, { includeAll: true }),
    taskPort.getRunnable(featureName),
  ]);
  const contextStats = contextAdapter.stats(featureName);
  const comments = plan?.comments || [];

  // Derive blocked tasks from the full task list
  const blocked = tasks
    .filter((t) => t.status === 'blocked')
    .map((t) => t.folder);

  const counts = countTaskStatuses(tasks);
  const runnableFolders = runnable.map((task) => task.folder);

  const planStatus = plan ? (plan.status === 'approved' ? 'approved' : 'draft') : null;
  const nextAction = getNextAction(
    planStatus,
    tasks.map((task) => ({ status: task.status, folder: task.folder })),
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
      totalBytes: contextStats.totalBytes,
    },
    nextAction,
  };
}
