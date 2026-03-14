import { randomUUID } from 'node:crypto';
import type { TaskInfo, WorkerSession } from '../types.ts';
import { getTaskSessionPath } from './paths.ts';
import { readJson, writeJsonAtomic } from './fs-io.ts';

export interface CreateTaskSessionParams {
  taskId: string;
  launcher: WorkerSession['launcher'];
  attempt: number;
  startedAt: string;
  workerPromptPath: string;
  pid?: number;
}

export function readTaskSession(projectRoot: string, feature: string, task: string): WorkerSession | null {
  return readJson<WorkerSession>(getTaskSessionPath(projectRoot, feature, task));
}

export function writeTaskSession(
  projectRoot: string,
  feature: string,
  task: string,
  session: WorkerSession,
): string {
  const sessionPath = getTaskSessionPath(projectRoot, feature, task);
  writeJsonAtomic(sessionPath, session);
  return sessionPath;
}

export function createTaskSession(params: CreateTaskSessionParams): WorkerSession {
  return {
    taskId: params.taskId,
    sessionId: randomUUID(),
    launcher: params.launcher,
    attempt: params.attempt,
    startedAt: params.startedAt,
    lastHeartbeatAt: params.startedAt,
    workerPromptPath: params.workerPromptPath,
    pid: params.pid,
  };
}

export function updateTaskSessionHeartbeat(
  projectRoot: string,
  feature: string,
  task: string,
  session: WorkerSession,
  timestamp: string,
): WorkerSession {
  const updated = {
    ...session,
    lastHeartbeatAt: timestamp,
  };
  writeTaskSession(projectRoot, feature, task, updated);
  return updated;
}

export function finalizeTaskSession(
  projectRoot: string,
  feature: string,
  task: string,
  session: WorkerSession,
  fields: Partial<WorkerSession>,
): WorkerSession {
  const updated = {
    ...session,
    ...fields,
  };
  writeTaskSession(projectRoot, feature, task, updated);
  return updated;
}

export function isTaskSessionStale(
  session: WorkerSession | null,
  staleTaskThresholdMinutes: number,
  now = new Date(),
): boolean {
  if (!session?.lastHeartbeatAt) {
    return true;
  }

  const heartbeat = new Date(session.lastHeartbeatAt);
  if (Number.isNaN(heartbeat.getTime())) {
    return true;
  }

  return now.getTime() - heartbeat.getTime() > staleTaskThresholdMinutes * 60_000;
}

export function hasManagedWorkerAttempt(
  task: Pick<TaskInfo, 'startedAt' | 'baseCommit' | 'workerSession'>,
): boolean {
  return Boolean(
    task.startedAt ||
    task.baseCommit ||
    task.workerSession?.sessionId ||
    task.workerSession?.attempt !== undefined ||
    task.workerSession?.launcher ||
    task.workerSession?.pid !== undefined ||
    task.workerSession?.workerPromptPath,
  );
}

export function isManagedTaskSessionStale(
  task: Pick<TaskInfo, 'startedAt' | 'baseCommit' | 'workerSession'>,
  session: WorkerSession | null,
  staleTaskThresholdMinutes: number,
  now = new Date(),
): boolean {
  if (!session && !hasManagedWorkerAttempt(task)) {
    return false;
  }

  return isTaskSessionStale(session, staleTaskThresholdMinutes, now);
}
