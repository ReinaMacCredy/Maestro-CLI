/**
 * TaskPort -- abstract interface for task storage.
 * Updated for 4-state model: pending, claimed, done, blocked.
 * Extended with rich bead fields for br backend.
 */

import type { TaskStatusType, TaskInfo } from '../types.ts';

export interface CreateOpts {
  labels?: string[];
  deps?: string[];
  description?: string;
  // Rich bead fields (used by BrTaskAdapter, ignored by FsTaskAdapter)
  design?: string;
  acceptanceCriteria?: string;
  notes?: string;
  type?: string;        // task, bug, feature, epic, chore, docs
  priority?: number;    // 0-4 (P0-P4)
  estimate?: number;    // minutes
}

export interface ListOpts {
  status?: TaskStatusType;
  includeAll?: boolean;
}

/** Rich fields available when backend supports them (br). */
export interface RichTaskFields {
  description?: string;
  design?: string;
  acceptanceCriteria?: string;
  notes?: string;
  type?: string;
  priority?: number;
  estimate?: number;
  labels?: string[];
  assignee?: string;
  comments?: Array<{ body: string; author: string; timestamp: string }>;
}

export interface TaskPort {
  // CRUD
  create(feature: string, title: string, opts?: CreateOpts): Promise<TaskInfo>;
  get(feature: string, id: string): Promise<TaskInfo | null>;
  list(feature: string, opts?: ListOpts): Promise<TaskInfo[]>;
  remove(feature: string, id: string): Promise<void>;
  // State transitions
  claim(feature: string, id: string, agentId: string): Promise<TaskInfo>;
  done(feature: string, id: string, summary: string): Promise<TaskInfo>;
  block(feature: string, id: string, reason: string): Promise<TaskInfo>;
  unblock(feature: string, id: string, decision: string): Promise<TaskInfo>;
  // Queries
  getRunnable(feature: string): Promise<TaskInfo[]>;
  // Specs and reports
  readSpec(feature: string, id: string): Promise<string | null>;
  writeSpec(feature: string, id: string, content: string): Promise<void>;
  readReport(feature: string, id: string): Promise<string | null>;
  writeReport(feature: string, id: string, content: string): Promise<void>;

  // Optional rich methods (BrTaskAdapter implements, FsTaskAdapter returns null/no-op)
  getRichFields?(feature: string, id: string): Promise<RichTaskFields | null>;
  updateRichFields?(feature: string, id: string, fields: Partial<RichTaskFields>): Promise<void>;
  suggestNext?(feature: string, id: string): Promise<TaskInfo[]>;
  addComment?(feature: string, id: string, body: string): Promise<void>;
}

/**
 * Valid state transitions for task status (4-state model).
 *
 *   pending  --> claimed, blocked
 *   claimed  --> done, blocked, pending (release)
 *   blocked  --> pending (unblock)
 *   done     --> pending (reopen)
 */
export const VALID_TRANSITIONS: Record<TaskStatusType, TaskStatusType[]> = {
  pending: ['claimed', 'blocked'],
  claimed: ['done', 'blocked', 'pending'],
  blocked: ['pending'],
  done: ['pending'],
};

export function isValidTransition(from: TaskStatusType, to: TaskStatusType): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
