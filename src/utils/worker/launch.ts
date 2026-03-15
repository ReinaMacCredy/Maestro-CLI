/**
 * Worker prompt preparation for maestroCLI.
 * Builds spec and prompt artifacts before a direct worker launch.
 */

import * as path from 'path';
import {
  buildWorkerPrompt,
  type WorkerContextFile,
  type CompletedTask,
  type ContinueFrom,
  type ContinueFromStatus,
} from './prompt.ts';
import { applyTaskBudget, applyContextBudget, DEFAULT_BUDGET, type TruncationEvent } from './budgeting.ts';
import { writeWorkerPromptFile } from './file.ts';
import { normalizePath } from '../paths.ts';
import { buildSpecContent } from './spec.ts';
import type { TaskPort } from '../../ports/tasks.ts';
import type { PlanPort } from '../../ports/plans.ts';
import type { ContextPort } from '../../ports/context.ts';
import type { TaskInfo } from '../../types.ts';

export interface WorkerLaunchServices {
  taskPort: TaskPort;
  planAdapter: PlanPort;
  contextAdapter: ContextPort;
  directory: string;
}

export interface WorkerLaunchParams {
  feature: string;
  task: string;
  taskInfo: TaskInfo;
  allTasks?: TaskInfo[];
  continueFrom?: ContinueFromStatus;
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
  workspacePath: string;
  truncationEvents: TruncationEvent[];
  droppedTasksHint?: string;
  droppedTaskCount: number;
}

export async function prepareWorkerLaunch(
  services: WorkerLaunchServices,
  params: WorkerLaunchParams,
): Promise<WorkerLaunchContext> {
  const { feature, task, taskInfo, continueFrom, decision } = params;
  const dependsOn = taskInfo.dependsOn ?? [];

  const planResult = services.planAdapter.read(feature);
  const allTasks = params.allTasks ?? await services.taskPort.list(feature, { includeAll: true });

  const rawContextFiles = services.contextAdapter.list(feature).map((file) => ({
    name: file.name,
    content: file.content,
  }));

  const rawPreviousTasks = allTasks
    .filter((currentTask) => currentTask.status === 'done' && currentTask.summary)
    .map((currentTask) => ({ name: currentTask.folder, summary: currentTask.summary! }));

  const taskBudgetResult = applyTaskBudget(rawPreviousTasks, { ...DEFAULT_BUDGET, feature });
  const contextBudgetResult = applyContextBudget(rawContextFiles, { ...DEFAULT_BUDGET, feature });

  const contextFiles: WorkerContextFile[] = contextBudgetResult.files;
  const previousTasks: CompletedTask[] = taskBudgetResult.tasks;
  const truncationEvents: TruncationEvent[] = [
    ...taskBudgetResult.truncationEvents,
    ...contextBudgetResult.truncationEvents,
  ];
  const droppedTasksHint = taskBudgetResult.droppedTasksHint;
  const droppedTaskCount = rawPreviousTasks.length - previousTasks.length;

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
    allTasks: allTasks.map((currentTask) => ({
      folder: currentTask.folder,
      name: currentTask.name,
      order: parseInt(currentTask.folder.match(/^(\d+)/)?.[1] || '0', 10),
    })),
    planContent: planResult?.content ?? null,
    contextFiles,
    completedTasks: previousTasks,
  });

  await services.taskPort.writeSpec(feature, task, specContent);

  const previousSummary = taskInfo.summary || 'No previous summary';
  let continueFromParam: ContinueFrom | undefined;
  if (continueFrom === 'blocked') {
    continueFromParam = {
      status: 'blocked',
      previousSummary,
      decision: decision || 'No decision provided',
    };
  } else if (continueFrom === 'partial') {
    continueFromParam = {
      status: 'partial',
      previousSummary,
    };
  }

  const workerPrompt = buildWorkerPrompt({
    feature,
    task,
    taskOrder,
    workspacePath: services.directory,
    plan: planResult?.content || 'No plan available',
    contextFiles,
    spec: specContent,
    previousTasks,
    continueFrom: continueFromParam,
    droppedTaskCount,
    droppedTasksHint,
  });

  const maestroDir = path.join(services.directory, '.maestro');
  const workerPromptPath = writeWorkerPromptFile(feature, task, workerPrompt, maestroDir);
  const relativePromptPath = normalizePath(path.relative(services.directory, workerPromptPath));

  return {
    workerPromptPath: relativePromptPath,
    workerPrompt,
    specContent,
    planContent: planResult?.content || '',
    contextFiles,
    previousTasks,
    taskOrder,
    workspacePath: services.directory,
    truncationEvents,
    droppedTasksHint,
    droppedTaskCount,
  };
}
