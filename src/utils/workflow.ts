/**
 * Workflow utilities for maestroCLI.
 * Forked from hive-core/src/utils/workflow.ts.
 * Adapted: tool references changed from maestro_ MCP calls to maestro CLI commands.
 */

export function countTaskStatuses(tasks: Array<{ status: string }>): {
  pending: number;
  inProgress: number;
  done: number;
} {
  const counts = { pending: 0, inProgress: 0, done: 0 };
  for (const t of tasks) {
    if (t.status === 'pending') counts.pending++;
    else if (t.status === 'in_progress') counts.inProgress++;
    else if (t.status === 'done') counts.done++;
  }
  return counts;
}

export function getNextAction(
  planStatus: string | null,
  tasks: Array<{ status: string; folder: string }>,
  runnableTasks: string[],
  staleTasks: string[] = [],
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
  if (staleTasks.length > 0) {
    return `Recover stale task with maestro task-start --task ${staleTasks[0]} --force`;
  }
  let inProgressFolder: string | undefined;
  let partialFolder: string | undefined;
  let blockedFolder: string | undefined;
  let failedFolder: string | undefined;
  let hasPending = false;
  for (const t of tasks) {
    if (!inProgressFolder && t.status === 'in_progress') inProgressFolder = t.folder;
    if (!partialFolder && t.status === 'partial') partialFolder = t.folder;
    if (!blockedFolder && t.status === 'blocked') blockedFolder = t.folder;
    if (!failedFolder && t.status === 'failed') failedFolder = t.folder;
    if (!hasPending && t.status === 'pending') hasPending = true;
    if (inProgressFolder && partialFolder && blockedFolder && failedFolder && hasPending) break;
  }
  if (inProgressFolder) {
    return `Continue work on task: ${inProgressFolder}`;
  }
  if (partialFolder) {
    return `Resume partial task with maestro task-start --task ${partialFolder} --continue-from partial`;
  }
  if (blockedFolder) {
    return `Review blocker on task ${blockedFolder} and resume with maestro task-start --task ${blockedFolder} --continue-from blocked --decision "<text>"`;
  }
  if (failedFolder) {
    return `Reset failed task with maestro task-update --task ${failedFolder} --status pending`;
  }
  if (runnableTasks.length > 1) {
    return `${runnableTasks.length} tasks are ready to start one at a time: ${runnableTasks.join(', ')}`;
  }
  if (runnableTasks.length === 1) {
    return `Start next task with maestro task-start: ${runnableTasks[0]}`;
  }
  if (hasPending) {
    return `Pending tasks exist but are blocked by dependencies. Check blockedBy for details.`;
  }
  return 'All tasks complete. Review the feature and mark it complete when ready.';
}

export function deriveTaskNextAction(status: string): string | undefined {
  switch (status) {
    case 'blocked':
      return 'Review the blocker and resume with task-start --continue-from blocked --decision "<text>".';
    case 'partial':
      return 'Review partial progress and resume with task-start --continue-from partial.';
    case 'failed':
      return 'Reset the task to pending before retrying.';
    default:
      return undefined;
  }
}
