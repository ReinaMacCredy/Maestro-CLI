/**
 * check-status use case.
 * Composite query for feature, plan, tasks, context, and stale sessions.
 */

import type { TaskPort } from '../ports/tasks.ts';
import type { FeaturePort } from '../ports/features.ts';
import type { PlanPort } from '../ports/plans.ts';
import type { ContextPort } from '../ports/context.ts';
import { countTaskStatuses, getNextAction } from '../utils/workflow.ts';
import { isManagedTaskSessionStale, readTaskSession } from '../utils/task-session.ts';
import type { TaskInfo, FeatureStatusType, PlanComment } from '../types.ts';
import type { FsConfigAdapter } from '../adapters/fs/config.ts';

export interface StatusServices {
  taskPort: TaskPort;
  featureAdapter: FeaturePort;
  planAdapter: PlanPort;
  contextAdapter: ContextPort;
  configAdapter: FsConfigAdapter;
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
  const { taskPort, featureAdapter, planAdapter, contextAdapter, configAdapter, directory } = services;
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
  const staleTaskThresholdMinutes = configAdapter.get().staleTaskThresholdMinutes;

  const zombies = tasks
    .filter((task) => task.status === 'in_progress')
    .filter((task) => {
      const session = readTaskSession(directory, featureName, task.folder);
      return isManagedTaskSessionStale(task, session, staleTaskThresholdMinutes);
    })
    .map((task) => task.folder);

  const counts = countTaskStatuses(tasks);
  const runnableFolders = runnable.map((task) => task.folder);

  const planStatus = plan ? (plan.status === 'approved' ? 'approved' : 'draft') : null;
  const nextAction = getNextAction(
    planStatus,
    tasks.map((task) => ({ status: task.status, folder: task.folder })),
    runnableFolders,
    zombies,
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
