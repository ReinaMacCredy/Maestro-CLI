import { MaestroError } from '../lib/errors.ts';
import type { TaskPort } from '../ports/tasks.ts';
import type { TaskStatusType } from '../types.ts';
import { collectGitAuditSummary, type GitAuditSummary } from '../utils/git.ts';
import { readTaskSession } from '../utils/task-session.ts';
import { deriveTaskNextAction } from '../utils/workflow.ts';

export interface FinishTaskServices {
  taskPort: TaskPort;
  directory: string;
}

export interface FinishTaskParams {
  feature: string;
  task: string;
  status: 'completed' | 'blocked' | 'failed' | 'partial';
  summary: string;
  blockerReason?: string;
  blockerRecommendation?: string;
  workerExitCode?: number;
  workerSignal?: string;
}

export interface FinishTaskResult {
  success: boolean;
  terminal: boolean;
  status: TaskStatusType;
  summary: string;
  audit: GitAuditSummary;
  nextAction?: string;
  suggestNext?: string[];
}

function buildReportContent(params: {
  task: string;
  status: FinishTaskParams['status'];
  summary: string;
  blockerReason?: string;
  blockerRecommendation?: string;
  audit: GitAuditSummary;
  launcher?: string;
  attempt?: number;
  sessionId?: string;
  workerExitCode?: number;
  workerSignal?: string;
}): string {
  const lines = [
    `# Task Report: ${params.task}`,
    '',
    `## Status: ${params.status}`,
    '',
    '## Summary',
    params.summary,
  ];

  if (params.blockerReason || params.blockerRecommendation) {
    lines.push('', '## Blocker');
    if (params.blockerReason) lines.push(`- Reason: ${params.blockerReason}`);
    if (params.blockerRecommendation) lines.push(`- Recommendation: ${params.blockerRecommendation}`);
  }

  lines.push(
    '',
    '## Git Audit',
    `- Base commit: ${params.audit.baseCommit || 'unknown'}`,
    `- Head commit: ${params.audit.headCommit}`,
    `- Dirty working tree: ${params.audit.dirtyWorkingTree ? 'yes' : 'no'}`,
    `- Changed since base: ${params.audit.changedFilesSinceBase.join(', ') || 'none'}`,
    `- Uncommitted files: ${params.audit.uncommittedFiles.join(', ') || 'none'}`,
  );

  lines.push('', '## Worker Session');
  lines.push(`- Launcher: ${params.launcher || 'unknown'}`);
  if (params.attempt !== undefined) lines.push(`- Attempt: ${params.attempt}`);
  if (params.sessionId) lines.push(`- Session ID: ${params.sessionId}`);
  if (params.workerExitCode !== undefined) lines.push(`- Exit code: ${params.workerExitCode}`);
  if (params.workerSignal) lines.push(`- Signal: ${params.workerSignal}`);

  return lines.join('\n');
}

export async function finishTask(
  services: FinishTaskServices,
  params: FinishTaskParams,
): Promise<FinishTaskResult> {
  const { taskPort, directory } = services;
  const { feature, task, status, summary, blockerReason, blockerRecommendation, workerExitCode, workerSignal } = params;

  const taskInfo = await taskPort.get(feature, task);
  if (!taskInfo) {
    throw new MaestroError(`Task '${task}' not found`);
  }
  if (taskInfo.status !== 'in_progress') {
    throw new MaestroError(
      `Cannot finish task '${task}' with status '${taskInfo.status}'`,
      ['Task must be in_progress before task-finish can be used'],
    );
  }
  if (status === 'blocked' && !blockerReason) {
    throw new MaestroError(
      'Blocked tasks require --blocker-reason',
      ['Provide a concise blocker reason so the orchestrator can resume safely'],
    );
  }

  const session = readTaskSession(directory, feature, task);
  const completedAt = new Date().toISOString();
  const audit = await collectGitAuditSummary(directory, taskInfo.baseCommit);

  const commonFields = {
    summary,
    baseCommit: taskInfo.baseCommit,
    startedAt: taskInfo.startedAt || session?.startedAt,
    completedAt,
    workerSession: {
      sessionId: session?.sessionId,
      launcher: session?.launcher,
      attempt: session?.attempt,
      workerPromptPath: session?.workerPromptPath,
      exitCode: workerExitCode,
      signal: workerSignal,
      lastHeartbeatAt: session?.lastHeartbeatAt,
    },
  };

  let nextAction: string | undefined;
  let suggestNext: string[] | undefined;
  let taskStatus: TaskStatusType;

  if (status === 'completed') {
    await taskPort.update(feature, task, commonFields);
    const closeResult = await taskPort.close(feature, task);
    taskStatus = 'done';
    suggestNext = closeResult.suggestNext;
    nextAction = closeResult.suggestNext?.length
      ? `Start next task: ${closeResult.suggestNext.join(', ')}`
      : undefined;
  } else if (status === 'failed') {
    await taskPort.update(feature, task, commonFields);
    await taskPort.close(feature, task, 'failed');
    taskStatus = 'failed';
    nextAction = deriveTaskNextAction('failed');
  } else {
    // blocked and partial: update with explicit status, derive next action
    await taskPort.update(feature, task, { ...commonFields, status });
    taskStatus = status;
    nextAction = deriveTaskNextAction(status);
  }

  const reportContent = buildReportContent({
    task,
    status,
    summary,
    blockerReason,
    blockerRecommendation,
    audit,
    launcher: session?.launcher,
    attempt: session?.attempt,
    sessionId: session?.sessionId,
    workerExitCode,
    workerSignal,
  });
  await taskPort.writeReport(feature, task, reportContent);

  return {
    success: true,
    terminal: status === 'completed' || status === 'failed',
    status: taskStatus,
    summary,
    audit,
    nextAction,
    suggestNext,
  };
}
