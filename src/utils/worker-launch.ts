/**
 * Worker launch orchestration for maestroCLI.
 * Forked from hive-core/src/utils/worker-launch.ts.
 * Adapted: TaskService -> TaskPort, buildSpecContent imported from spec-builder.ts.
 * PlanService and ContextService kept as concrete types (pragmatic).
 */

import * as path from 'path';
import { buildWorkerPrompt, type WorkerContextFile, type CompletedTask, type ContinueFromBlocked } from './worker-prompt.ts';
import { applyTaskBudget, applyContextBudget, DEFAULT_BUDGET, type TruncationEvent } from './prompt-budgeting.ts';
import { writeWorkerPromptFile } from './prompt-file.ts';
import { normalizePath } from './paths.ts';
import { buildSpecContent } from './spec-builder.ts';
import type { TaskPort } from '../ports/tasks.ts';
import type { FsPlanAdapter } from '../adapters/fs-plan.ts';
import type { FsContextAdapter } from '../adapters/fs-context.ts';
import type { WorktreeInfo, TaskInfo } from '../types.ts';

export interface WorkerLaunchServices {
  taskPort: TaskPort;
  planAdapter: FsPlanAdapter;
  contextAdapter: FsContextAdapter;
  directory: string;
}

export interface WorkerLaunchParams {
  feature: string;
  task: string;
  taskInfo: TaskInfo;
  worktree: WorktreeInfo;
  continueFrom?: 'blocked';
  decision?: string;
}

export interface WorkerLaunchContext {
  workerPromptPath: string;
  workerPrompt: string;
  specContent: string;
  planContent: string;
  contextFiles: WorkerContextFile[];
  previousTasks: CompletedTask[];
  taskOrder: number;
  worktreePath: string;
  branch: string;
  truncationEvents: TruncationEvent[];
  droppedTasksHint?: string;
  droppedTaskCount: number;
}

export async function prepareWorkerLaunch(
  services: WorkerLaunchServices,
  params: WorkerLaunchParams,
): Promise<WorkerLaunchContext> {
  const { feature, task, taskInfo, worktree, continueFrom, decision } = params;

  // Get task to read dependsOn before updating
  const currentTask = await services.taskPort.get(feature, task);
  const dependsOn = currentTask?.dependsOn ?? [];

  await services.taskPort.update(feature, task, {
    status: 'in_progress',
    baseCommit: worktree.commit,
  });

  const planResult = services.planAdapter.read(feature);
  const allTasks = await services.taskPort.list(feature);

  const rawContextFiles = services.contextAdapter.list(feature).map(f => ({
    name: f.name,
    content: f.content,
  }));

  const rawPreviousTasks = allTasks
    .filter(t => t.status === 'done' && t.summary)
    .map(t => ({ name: t.folder, summary: t.summary! }));

  const taskBudgetResult = applyTaskBudget(rawPreviousTasks, { ...DEFAULT_BUDGET, feature });
  const contextBudgetResult = applyContextBudget(rawContextFiles, { ...DEFAULT_BUDGET, feature });

  const contextFiles: WorkerContextFile[] = contextBudgetResult.files.map(f => ({
    name: f.name,
    content: f.content,
  }));
  const previousTasks: CompletedTask[] = taskBudgetResult.tasks.map(t => ({
    name: t.name,
    summary: t.summary,
  }));

  const truncationEvents: TruncationEvent[] = [
    ...taskBudgetResult.truncationEvents,
    ...contextBudgetResult.truncationEvents,
  ];

  const droppedTasksHint = taskBudgetResult.droppedTasksHint;

  const taskOrder = parseInt(taskInfo.folder.match(/^(\d+)/)?.[1] || '0', 10);
  const specContent = buildSpecContent({
    featureName: feature,
    task: {
      folder: task,
      name: taskInfo.planTitle ?? taskInfo.name,
      order: taskOrder,
      description: undefined,
    },
    dependsOn,
    allTasks: allTasks.map(t => ({
      folder: t.folder,
      name: t.name,
      order: parseInt(t.folder.match(/^(\d+)/)?.[1] || '0', 10),
    })),
    planContent: planResult?.content ?? null,
    contextFiles,
    completedTasks: previousTasks,
  });

  await services.taskPort.writeSpec(feature, task, specContent);

  const continueFromParam: ContinueFromBlocked | undefined = continueFrom === 'blocked' ? {
    status: 'blocked',
    previousSummary: taskInfo.summary || 'No previous summary',
    decision: decision || 'No decision provided',
  } : undefined;

  const workerPrompt = buildWorkerPrompt({
    feature,
    task,
    taskOrder,
    worktreePath: worktree.path,
    branch: worktree.branch,
    plan: planResult?.content || 'No plan available',
    contextFiles,
    spec: specContent,
    previousTasks,
    continueFrom: continueFromParam,
  });

  const hiveDir = path.join(services.directory, '.hive');
  const workerPromptPath = writeWorkerPromptFile(feature, task, workerPrompt, hiveDir);
  const relativePromptPath = normalizePath(path.relative(services.directory, workerPromptPath));

  return {
    workerPromptPath: relativePromptPath,
    workerPrompt,
    specContent,
    planContent: planResult?.content || '',
    contextFiles,
    previousTasks,
    taskOrder,
    worktreePath: worktree.path,
    branch: worktree.branch,
    truncationEvents,
    droppedTasksHint,
    droppedTaskCount: rawPreviousTasks.length - previousTasks.length,
  };
}
