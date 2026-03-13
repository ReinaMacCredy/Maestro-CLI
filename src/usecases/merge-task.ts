/**
 * merge-task use case.
 * Merge worktree branch, close task via TaskPort.
 */

import type { TaskPort } from '../ports/tasks.ts';
import type { GitWorktreeAdapter } from '../adapters/git-worktree.ts';
import { MaestroError } from '../lib/errors.ts';
import type { MergeResult } from '../types.ts';

export interface MergeTaskServices {
  taskPort: TaskPort;
  worktreeAdapter: GitWorktreeAdapter;
}

export interface MergeTaskParams {
  feature: string;
  task: string;
  strategy?: 'merge' | 'squash' | 'rebase';
  deleteBranch?: boolean;
}

export interface MergeTaskResult {
  merged: boolean;
  sha?: string;
  filesChanged?: string[];
  conflicts?: string[];
  suggestNext?: string[];
}

export async function mergeTask(
  services: MergeTaskServices,
  params: MergeTaskParams,
): Promise<MergeTaskResult> {
  const { taskPort, worktreeAdapter } = services;
  const { feature, task, strategy = 'merge', deleteBranch = true } = params;

  // Verify task is done
  const taskInfo = await taskPort.get(feature, task);
  if (!taskInfo) throw new MaestroError(`Task '${task}' not found`);
  if (taskInfo.status !== 'done') {
    throw new MaestroError(
      `Cannot merge task '${task}' with status '${taskInfo.status}'`,
      ['Task must have status "done" before merging']
    );
  }

  // Check for conflicts before merging
  const conflicts = await worktreeAdapter.checkConflicts(feature, task);
  if (conflicts.length > 0) {
    throw new MaestroError(
      `Merge conflicts detected in ${conflicts.length} file(s): ${conflicts.join(', ')}`,
      ['Resolve conflicts in the worktree first, then retry merge']
    );
  }

  // Merge
  const mergeResult: MergeResult = await worktreeAdapter.merge(feature, task, strategy);

  if (!mergeResult.success) {
    throw new MaestroError(
      mergeResult.error || 'Merge failed',
      mergeResult.conflicts ? [`Conflicting files: ${mergeResult.conflicts.join(', ')}`] : []
    );
  }

  // Close task and get suggestions for next tasks
  const closeResult = await taskPort.close(feature, task);

  // Clean up worktree
  await worktreeAdapter.remove(feature, task, deleteBranch);

  return {
    merged: mergeResult.merged,
    sha: mergeResult.sha,
    filesChanged: mergeResult.filesChanged,
    conflicts: mergeResult.conflicts,
    suggestNext: closeResult.suggestNext,
  };
}
