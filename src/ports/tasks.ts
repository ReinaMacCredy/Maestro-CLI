/**
 * TaskPort -- abstract interface for task storage.
 * Concrete implementations: BrTaskAdapter (br CLI), InMemoryTaskPort (tests).
 */

import type { TaskStatusType, TaskOrigin, TaskInfo, WorkerSession } from '../types.ts';

export interface CreateOpts {
  labels?: string[];
  parent?: string;
  deps?: string[];
  description?: string;
}

export interface UpdateFields {
  status?: TaskStatusType;
  description?: string;
  notes?: string;
  summary?: string;
  baseCommit?: string;
  startedAt?: string;
  completedAt?: string;
  workerSession?: Partial<WorkerSession>;
}

export interface ListOpts {
  status?: TaskStatusType;
  includeAll?: boolean;
}

export interface TaskPort {
  create(feature: string, title: string, opts?: CreateOpts): Promise<TaskInfo>;
  update(feature: string, id: string, fields: UpdateFields): Promise<TaskInfo>;
  get(feature: string, id: string): Promise<TaskInfo | null>;
  list(feature: string, opts?: ListOpts): Promise<TaskInfo[]>;
  close(feature: string, id: string, reason?: string): Promise<{ suggestNext?: string[] }>;
  addDependency(feature: string, taskId: string, dependsOnId: string): Promise<void>;
  getRunnable(feature: string): Promise<TaskInfo[]>;
  getBlocked(feature: string): Promise<Record<string, string[]>>;
  readSpec(feature: string, id: string): Promise<string | null>;
  writeSpec(feature: string, id: string, content: string): Promise<void>;
  readReport(feature: string, id: string): Promise<string | null>;
  writeReport(feature: string, id: string, content: string): Promise<void>;
  isAvailable(): Promise<boolean>;
  installHint(): string;
}

/**
 * Valid state transitions for task status.
 *
 *   pending     --> in_progress, cancelled
 *   in_progress --> done, blocked, failed, partial, cancelled
 *   blocked     --> in_progress, cancelled
 *   partial     --> in_progress, cancelled
 *   failed      --> pending (retry)
 *   done        --> pending (reopen)
 *   cancelled   --> pending (reopen)
 */
export const VALID_TRANSITIONS: Record<TaskStatusType, TaskStatusType[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['done', 'blocked', 'failed', 'partial', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  partial: ['in_progress', 'cancelled'],
  failed: ['pending'],
  done: ['pending'],
  cancelled: ['pending'],
};

export function isValidTransition(from: TaskStatusType, to: TaskStatusType): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
