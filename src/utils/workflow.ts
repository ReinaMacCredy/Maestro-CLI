/**
 * Workflow utilities for maestroCLI.
 * Updated for 4-state model (pending/claimed/done/blocked).
 */

import type { TaskStatusType } from '../types.ts';

export type PipelineStage = 'discovery' | 'research' | 'planning' | 'approval' | 'execution' | 'done';

export function derivePipelineStage(opts: {
  planExists: boolean;
  planApproved: boolean;
  taskTotal: number;
  taskDone: number;
  contextCount: number;
}): PipelineStage {
  if (!opts.planExists && opts.taskTotal === 0) {
    return opts.contextCount > 0 ? 'research' : 'discovery';
  }
  if (opts.planExists && !opts.planApproved) return 'planning';
  if (opts.planApproved && opts.taskTotal === 0) return 'planning';
  if (opts.taskTotal > 0 && opts.taskDone < opts.taskTotal) return 'execution';
  if (opts.taskTotal > 0 && opts.taskDone === opts.taskTotal) return 'done';
  return 'discovery';
}

export function countTaskStatuses(tasks: Array<{ status: TaskStatusType }>): {
  pending: number;
  inProgress: number;
  done: number;
} {
  const counts = { pending: 0, inProgress: 0, done: 0 };
  for (const t of tasks) {
    if (t.status === 'pending') counts.pending++;
    else if (t.status === 'claimed') counts.inProgress++;
    else if (t.status === 'done') counts.done++;
    // blocked tasks counted separately via filter
  }
  return counts;
}

export function getNextAction(
  planStatus: string | null,
  tasks: Array<{ status: TaskStatusType; folder: string }>,
  runnableTasks: string[],
): string {
  if (!planStatus || planStatus === 'draft') {
    return 'Write or revise plan with maestro plan-write, then get approval';
  }
  if (planStatus === 'review') {
    return 'Wait for plan approval or revise based on comments';
  }
  if (tasks.length === 0) {
    return 'Generate tasks from plan with maestro task-sync';
  }

  let claimedFolder: string | undefined;
  let blockedFolder: string | undefined;
  let hasPending = false;
  for (const t of tasks) {
    if (!claimedFolder && t.status === 'claimed') claimedFolder = t.folder;
    if (!blockedFolder && t.status === 'blocked') blockedFolder = t.folder;
    if (!hasPending && t.status === 'pending') hasPending = true;
    if (claimedFolder && blockedFolder && hasPending) break;
  }

  if (claimedFolder) {
    return `Task in progress: ${claimedFolder}`;
  }
  if (blockedFolder) {
    return `Review blocker on task ${blockedFolder} and unblock with task_unblock`;
  }
  if (runnableTasks.length > 1) {
    return `${runnableTasks.length} tasks ready -- claim with task_claim: ${runnableTasks.join(', ')}`;
  }
  if (runnableTasks.length === 1) {
    return `Claim next task with task_claim: ${runnableTasks[0]}`;
  }
  if (hasPending) {
    return 'Pending tasks exist but are blocked by dependencies. Check blockedBy for details.';
  }
  return 'All tasks complete. Review the feature and mark it complete when ready.';
}
