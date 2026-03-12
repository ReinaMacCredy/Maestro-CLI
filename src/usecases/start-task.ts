/**
 * start-task use case.
 * Check deps, create worktree, update task to in_progress, build worker prompt.
 */

import type { TaskPort } from '../ports/tasks.ts';
import type { FsFeatureAdapter } from '../adapters/fs-feature.ts';
import type { GitWorktreeAdapter } from '../adapters/git-worktree.ts';
import { checkDependencies } from '../utils/feature-resolution.ts';
import { MaestroError } from '../lib/errors.ts';
import { prepareWorkerLaunch, type WorkerLaunchServices, type WorkerLaunchContext } from '../utils/worker-launch.ts';
import type { FsPlanAdapter } from '../adapters/fs-plan.ts';
import type { FsContextAdapter } from '../adapters/fs-context.ts';

export interface StartTaskParams {
  feature: string;
  task: string;
  continueFrom?: 'blocked';
  decision?: string;
}

export interface StartTaskResult {
  workerPromptPath: string;
  worktreePath: string;
  branch: string;
  taskOrder: number;
  delegationRequired: boolean;
}

export async function startTask(
  taskPort: TaskPort,
  featureAdapter: FsFeatureAdapter,
  worktreeAdapter: GitWorktreeAdapter,
  planAdapter: FsPlanAdapter,
  contextAdapter: FsContextAdapter,
  directory: string,
  params: StartTaskParams,
): Promise<StartTaskResult> {
  const { feature, task, continueFrom, decision } = params;

  // Validate feature exists
  const featureData = featureAdapter.get(feature);
  if (!featureData) throw new MaestroError(`Feature '${feature}' not found`);
  if (featureData.status === 'completed') {
    throw new MaestroError(`Feature '${feature}' is completed`);
  }

  // Get task info
  const taskInfo = await taskPort.get(feature, task);
  if (!taskInfo) throw new MaestroError(`Task '${task}' not found in feature '${feature}'`);

  // Check dependencies (unless continuing from blocked)
  if (!continueFrom) {
    const depCheck = await checkDependencies(taskPort, feature, task);
    if (!depCheck.allowed) {
      throw new MaestroError(depCheck.error, [
        'Complete dependency tasks first, or use maestro task-update to skip'
      ]);
    }
  }

  // Create worktree
  const worktree = await worktreeAdapter.create(feature, task);

  // Prepare worker launch (updates task, builds prompt, writes prompt file)
  const services: WorkerLaunchServices = {
    taskPort,
    planAdapter,
    contextAdapter,
    directory,
  };

  const launchCtx: WorkerLaunchContext = await prepareWorkerLaunch(services, {
    feature,
    task,
    taskInfo,
    worktree,
    continueFrom,
    decision,
  });

  return {
    workerPromptPath: launchCtx.workerPromptPath,
    worktreePath: launchCtx.worktreePath,
    branch: launchCtx.branch,
    taskOrder: launchCtx.taskOrder,
    delegationRequired: true,
  };
}
