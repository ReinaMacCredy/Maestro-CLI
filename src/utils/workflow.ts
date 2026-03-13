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
  let inProgressFolder: string | undefined;
  let hasPending = false;
  for (const t of tasks) {
    if (!inProgressFolder && t.status === 'in_progress') inProgressFolder = t.folder;
    if (!hasPending && t.status === 'pending') hasPending = true;
    if (inProgressFolder && hasPending) break;
  }
  if (inProgressFolder) {
    return `Continue work on task: ${inProgressFolder}`;
  }
  if (runnableTasks.length > 1) {
    return `${runnableTasks.length} tasks are ready to start in parallel: ${runnableTasks.join(', ')}`;
  }
  if (runnableTasks.length === 1) {
    return `Start next task with maestro worktree-start: ${runnableTasks[0]}`;
  }
  if (hasPending) {
    return `Pending tasks exist but are blocked by dependencies. Check blockedBy for details.`;
  }
  return 'All tasks complete. Review and merge or complete feature.';
}
