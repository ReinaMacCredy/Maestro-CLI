import type { TaskPort } from '../ports/tasks.ts';
import type { GitWorktreeAdapter } from '../adapters/git-worktree.ts';
import { MaestroError } from '../lib/errors.ts';
import type { TaskStatusType } from '../types.ts';

export interface CommitTaskServices {
  taskPort: TaskPort;
  worktreeAdapter: GitWorktreeAdapter;
}

export interface CommitTaskParams {
  feature: string;
  task: string;
  status: 'completed' | 'blocked' | 'failed' | 'partial';
  summary: string;
  blockerReason?: string;
  blockerRecommendation?: string;
}

export interface CommitTaskResult {
  success: boolean;
  terminal: boolean;
  sha?: string;
  nextAction?: string;
}

export async function commitTask(
  services: CommitTaskServices,
  params: CommitTaskParams,
): Promise<CommitTaskResult> {
  const { taskPort, worktreeAdapter } = services;
  const { feature, task, status, summary } = params;

  // Map user-facing status to TaskStatusType
  const statusMap: Record<string, TaskStatusType> = {
    completed: 'done',
    blocked: 'blocked',
    failed: 'failed',
    partial: 'partial',
  };
  const taskStatus = statusMap[status];
  if (!taskStatus) throw new MaestroError(`Invalid status: ${status}`);

  // Commit any changes in the worktree
  const commitResult = await worktreeAdapter.commitChanges(feature, task, `maestro(${task}): ${summary}`);

  // Build report content (independent of update)
  const reportContent = [
    `# Task Report: ${task}`,
    '',
    `## Status: ${status}`,
    '',
    `## Summary`,
    summary,
    '',
    commitResult.committed ? `## Commit: ${commitResult.sha}` : '## No changes committed',
  ].join('\n');

  // Update task status and write report in parallel
  await Promise.all([
    taskPort.update(feature, task, { status: taskStatus, notes: summary }),
    taskPort.writeReport(feature, task, reportContent),
  ]);

  // Determine if terminal
  const isTerminal = status === 'completed' || status === 'failed';
  let nextAction: string | undefined;

  if (status === 'blocked') {
    nextAction = 'Escalate blocker to orchestrator. Stop working.';
  } else if (status === 'partial') {
    nextAction = 'Review partial progress and decide whether to continue or reassign.';
  }

  return {
    success: true,
    terminal: isTerminal,
    sha: commitResult.sha || undefined,
    nextAction,
  };
}
