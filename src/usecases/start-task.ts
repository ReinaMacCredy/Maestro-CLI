/**
 * start-task use case.
 * Launch a worker CLI directly in the project checkout and wait for it to finish.
 */

import type { ChildProcess, StdioOptions } from 'node:child_process';
import * as path from 'node:path';
import { MaestroError } from '../lib/errors.ts';
import { getOutputMode } from '../lib/output.ts';
import { checkDependencies } from '../utils/dependency-check.ts';
import { deriveTaskNextAction } from '../utils/workflow.ts';
import { prepareWorkerLaunch, type WorkerLaunchServices } from '../utils/worker/launch.ts';
import { createTaskSession, finalizeTaskSession, isTaskSessionStale, readTaskSession, updateTaskSessionHeartbeat } from '../utils/task-session.ts';
import { finishTask } from './finish-task.ts';
import { getHeadCommit } from '../utils/git.ts';
import type { TaskPort } from '../ports/tasks.ts';
import type { FeaturePort } from '../ports/features.ts';
import type { PlanPort } from '../ports/plans.ts';
import type { ContextPort } from '../ports/context.ts';
import type { WorkerCliName, TaskInfo, TaskStatusType } from '../types.ts';
import type { FsConfigAdapter } from '../adapters/fs/config.ts';
import type { CliWorkerRunner } from '../adapters/worker-runner.ts';
import { getTaskSessionPath, normalizePath } from '../utils/paths.ts';

export interface StartTaskServices {
  taskPort: TaskPort;
  featureAdapter: FeaturePort;
  planAdapter: PlanPort;
  contextAdapter: ContextPort;
  configAdapter: FsConfigAdapter;
  workerRunner: CliWorkerRunner;
  directory: string;
}

export interface StartTaskParams {
  feature: string;
  task: string;
  continueFrom?: 'blocked' | 'partial';
  decision?: string;
  force?: boolean;
}

export interface StartTaskResult {
  task: string;
  launcher: WorkerCliName;
  workerPromptPath: string;
  sessionPath: string;
  baseCommit: string;
  headCommit: string;
  childExitCode: number | null;
  childSignal: string | null;
  finalStatus: TaskStatusType;
  summary?: string;
  nextAction?: string;
}

interface ChildExitResult {
  code: number | null;
  signal: string | null;
}

function isRecordedWorkerAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') {
      return false;
    }
    if (code === 'EPERM') {
      return true;
    }
    throw error;
  }
}

function childStdioForCurrentOutputMode(): StdioOptions {
  const interactiveConsole = getOutputMode() !== 'json' &&
    process.stdin.isTTY &&
    process.stdout.isTTY &&
    process.stderr.isTTY;

  return interactiveConsole
    ? 'inherit'
    : ['ignore', 'pipe', 'pipe'];
}

async function waitForChild(child: ChildProcess): Promise<ChildExitResult> {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });
}

function attachPipedOutput(child: ChildProcess): void {
  if (child.stdout) {
    child.stdout.on('data', (chunk) => {
      process.stderr.write(chunk);
    });
  }
  if (child.stderr) {
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
    });
  }
}

export async function startTask(
  services: StartTaskServices,
  params: StartTaskParams,
): Promise<StartTaskResult> {
  const { taskPort, featureAdapter, planAdapter, contextAdapter, configAdapter, workerRunner, directory } = services;
  const { feature, task, continueFrom, decision, force = false } = params;

  featureAdapter.requireActive(feature);

  const config = configAdapter.get();
  const launcher = config.workerCli ?? 'codex';
  const staleTaskThresholdMinutes = config.staleTaskThresholdMinutes!;

  const allTasks = await taskPort.list(feature, { includeAll: true });
  const currentTask = allTasks.find((candidate) => candidate.folder === task);
  if (!currentTask) {
    throw new MaestroError(`Task '${task}' not found in feature '${feature}'`);
  }

  const otherInProgress = allTasks.filter(
    (candidate) => candidate.folder !== task && candidate.status === 'in_progress',
  );
  if (otherInProgress.length > 0) {
    throw new MaestroError(
      `Another task is already in progress: ${otherInProgress[0].folder}`,
      ['Only one task can run at a time in the main checkout'],
    );
  }

  const existingSession = readTaskSession(directory, feature, task);
  const isStale = currentTask.status === 'in_progress' &&
    isTaskSessionStale(existingSession, staleTaskThresholdMinutes);

  if (currentTask.status === 'in_progress') {
    if (!isStale) {
      throw new MaestroError(
        `Task '${task}' is already in progress`,
        ['Finish or recover the active attempt before starting again'],
      );
    }
    if (!force) {
      throw new MaestroError(
        `Task '${task}' appears stale`,
        [`Restart it with: maestro task-start --feature ${feature} --task ${task} --force`],
      );
    }
    if (existingSession?.pid && isRecordedWorkerAlive(existingSession.pid)) {
      throw new MaestroError(
        `Task '${task}' still has a live worker process (${existingSession.pid})`,
        ['Stop the existing worker before using --force to recover the task'],
      );
    }

    await finishTask(
      { taskPort, directory },
      {
        feature,
        task,
        status: 'failed',
        summary: 'Stale worker attempt recovered before relaunch.',
        workerSignal: 'stale-recovery',
      },
    );
    await taskPort.update(feature, task, { status: 'pending' });
    currentTask.status = 'pending';
    currentTask.summary = undefined;
  }

  if (continueFrom === 'blocked') {
    if (currentTask.status !== 'blocked') {
      throw new MaestroError(
        `Task '${task}' is not blocked`,
        ['Use --continue-from blocked only when restarting a blocked task'],
      );
    }
    if (!decision) {
      throw new MaestroError(
        'Blocked continuation requires --decision',
        ['Provide the user decision that unblocks the task'],
      );
    }
  } else if (continueFrom === 'partial') {
    if (currentTask.status !== 'partial') {
      throw new MaestroError(
        `Task '${task}' is not partial`,
        ['Use --continue-from partial only when resuming a partial task'],
      );
    }
  } else if (currentTask.status !== 'pending') {
    throw new MaestroError(
      `Task '${task}' must be pending to start`,
      ['Use task-update to reset failed/cancelled tasks before starting again'],
    );
  }

  if (!continueFrom) {
    const depCheck = await checkDependencies(taskPort, feature, task);
    if (!depCheck.allowed) {
      throw new MaestroError(depCheck.error, [
        'Complete dependency tasks first, or use maestro task-update to skip',
      ]);
    }
  }

  const launchServices: WorkerLaunchServices = {
    taskPort,
    planAdapter,
    contextAdapter,
    directory,
  };
  const [launchCtx, baseCommit] = await Promise.all([
    prepareWorkerLaunch(launchServices, {
      feature,
      task,
      taskInfo: currentTask,
      allTasks,
      continueFrom,
      decision,
    }),
    getHeadCommit(directory),
  ]);

  const startedAt = new Date().toISOString();
  const attempt = Math.max(existingSession?.attempt ?? currentTask.workerSession?.attempt ?? 0, 0) + 1;

  await taskPort.update(feature, task, {
    status: 'in_progress',
    baseCommit,
    startedAt,
  });

  const instruction = `Read and follow ${launchCtx.workerPromptPath}`;
  const stdio = childStdioForCurrentOutputMode();
  const { child } = workerRunner.launch({
    cli: launcher,
    cwd: directory,
    instruction,
    model: config.workerCliModel,
    extraArgs: config.workerCliArgs,
    stdio,
  });
  if (stdio !== 'inherit') {
    attachPipedOutput(child);
  }

  let session = createTaskSession({
    taskId: task,
    launcher,
    attempt,
    startedAt,
    workerPromptPath: launchCtx.workerPromptPath,
    pid: child.pid,
  });
  const sessionPath = normalizePath(
    path.relative(directory, getTaskSessionPath(directory, feature, task)),
  );
  finalizeTaskSession(directory, feature, task, session, {});

  const heartbeatInterval = setInterval(() => {
    session = updateTaskSessionHeartbeat(
      directory,
      feature,
      task,
      session,
      new Date().toISOString(),
    );
  }, 30_000);
  heartbeatInterval.unref();

  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const forwardSignal = (signal: NodeJS.Signals) => {
    if (child.killed || child.exitCode !== null) {
      return;
    }
    child.kill(signal);
    killTimer = setTimeout(() => {
      child.kill('SIGKILL');
    }, 5_000);
    killTimer.unref();
  };

  const onSigInt = () => forwardSignal('SIGINT');
  const onSigTerm = () => forwardSignal('SIGTERM');
  process.on('SIGINT', onSigInt);
  process.on('SIGTERM', onSigTerm);

  let childExit: ChildExitResult;
  let launchError: Error | undefined;
  try {
    childExit = await waitForChild(child);
  } catch (err) {
    launchError = err instanceof Error ? err : new Error(String(err));
    childExit = { code: 127, signal: null };
  } finally {
    clearInterval(heartbeatInterval);
    if (killTimer) clearTimeout(killTimer);
    process.removeListener('SIGINT', onSigInt);
    process.removeListener('SIGTERM', onSigTerm);
  }

  session = finalizeTaskSession(directory, feature, task, session, {
    exitCode: childExit.code === null ? undefined : childExit.code,
    signal: childExit.signal ?? undefined,
    lastHeartbeatAt: new Date().toISOString(),
  });

  let finalTask = await taskPort.get(feature, task);
  if (!finalTask) {
    throw new MaestroError(`Task '${task}' disappeared after worker exit`);
  }

  if (finalTask.status === 'in_progress') {
    const reason = launchError
      ? `Worker launcher '${launcher}' failed to start: ${launchError.message}`
      : childExit.signal
      ? `Worker launcher '${launcher}' exited from signal ${childExit.signal} before task-finish completed.`
      : childExit.code === 0
        ? `Worker launcher '${launcher}' exited cleanly without calling task-finish.`
        : `Worker launcher '${launcher}' exited with code ${childExit.code ?? 'unknown'} before task-finish completed.`;

    const autoFinish = await finishTask(
      { taskPort, directory },
      {
        feature,
        task,
        status: 'failed',
        summary: reason,
        workerExitCode: childExit.code ?? undefined,
        workerSignal: childExit.signal ?? undefined,
      },
    );
    finalTask = await taskPort.get(feature, task);
    if (!finalTask) {
      throw new MaestroError(`Task '${task}' disappeared after auto-failure`);
    }
    return {
      task,
      launcher,
      workerPromptPath: launchCtx.workerPromptPath,
      sessionPath,
      baseCommit,
      headCommit: autoFinish.audit.headCommit,
      childExitCode: childExit.code,
      childSignal: childExit.signal,
      finalStatus: finalTask.status,
      summary: finalTask.summary,
      nextAction: autoFinish.nextAction,
    };
  }

  await taskPort.update(feature, task, {
    workerSession: {
      sessionId: session.sessionId,
      launcher,
      attempt,
      exitCode: childExit.code ?? undefined,
      signal: childExit.signal ?? undefined,
      lastHeartbeatAt: session.lastHeartbeatAt,
      workerPromptPath: launchCtx.workerPromptPath,
    },
  });

  const headCommit = await getHeadCommit(directory);
  return {
    task,
    launcher,
    workerPromptPath: launchCtx.workerPromptPath,
    sessionPath,
    baseCommit,
    headCommit,
    childExitCode: childExit.code,
    childSignal: childExit.signal,
    finalStatus: finalTask.status,
    summary: finalTask.summary,
    nextAction: deriveTaskNextAction(finalTask.status),
  };
}
