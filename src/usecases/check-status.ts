/**
 * check-status use case.
 * Composite query for feature, plan, tasks, and context.
 */

import type { TaskPort } from '../ports/tasks.ts';
import type { FeaturePort } from '../ports/features.ts';
import type { PlanPort } from '../ports/plans.ts';
import type { MemoryPort } from '../ports/memory.ts';
import type { GraphPort } from '../ports/graph.ts';
import type { SearchPort } from '../ports/search.ts';
import type { HandoffPort } from '../ports/handoff.ts';
import { countTaskStatuses, getNextAction } from '../utils/workflow.ts';
import type { FsConfigAdapter } from '../adapters/fs/config.ts';
import type { TaskInfo, FeatureStatusType, PlanComment } from '../types.ts';

export interface StatusServices {
  taskPort: TaskPort;
  featureAdapter: FeaturePort;
  planAdapter: PlanPort;
  memoryAdapter: MemoryPort;
  configAdapter: FsConfigAdapter;
  directory: string;
  graphPort?: GraphPort;
  handoffPort?: HandoffPort;
  searchPort?: SearchPort;
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
  expiredClaims: string[];
  context: {
    count: number;
    totalBytes: number;
  };
  integrations: {
    bv: boolean;
    agentMail: boolean;
    cass: boolean;
  };
  nextAction: string;
}

export async function checkStatus(
  services: StatusServices,
  featureName: string,
): Promise<StatusResult> {
  const { taskPort, featureAdapter, planAdapter, memoryAdapter, configAdapter } = services;
  const feature = featureAdapter.get(featureName);
  if (!feature) {
    throw new Error(`Feature '${featureName}' not found`);
  }

  const plan = planAdapter.read(featureName);
  const tasks = await taskPort.list(featureName, { includeAll: true });
  const memoryStats = memoryAdapter.stats(featureName);
  const comments = plan?.comments || [];

  // Detect expired claims
  const claimExpiresMinutes = configAdapter.get().claimExpiresMinutes ?? 120;
  const expiryMs = claimExpiresMinutes * 60 * 1000;
  const now = Date.now();
  const expiredClaims = tasks
    .filter(t => t.status === 'claimed' && t.claimedAt && now - new Date(t.claimedAt).getTime() > expiryMs)
    .map(t => t.folder);

  // Derive blocked from task list
  const blocked = tasks
    .filter((t) => t.status === 'blocked')
    .map((t) => t.folder);

  // Use getRunnable() for accurate dependency-aware resolution
  // (br list doesn't include dependency data, so local computation misses deps)
  const runnable = await taskPort.getRunnable(featureName);
  const runnableFolders = runnable.map(t => t.folder);

  const counts = countTaskStatuses(tasks);

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
    expiredClaims,
    context: {
      count: memoryStats.count,
      totalBytes: memoryStats.totalBytes,
    },
    integrations: {
      bv: !!services.graphPort,
      agentMail: !!services.handoffPort,
      cass: !!services.searchPort,
    },
    nextAction,
  };
}
