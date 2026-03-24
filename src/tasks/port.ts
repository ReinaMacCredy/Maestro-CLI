/**
 * TaskPort -- abstract interface for task storage.
 * Updated for 6-state model: pending, claimed, done, blocked, review, revision.
 * Extended with rich bead fields for br backend.
 */

import type { TaskStatusType, TaskInfo } from '../core/types.ts';
import type { VerificationReport } from './verification/port.ts';

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
  // State transitions (verification)
  review(feature: string, id: string, summary: string): Promise<TaskInfo>;
  revision(feature: string, id: string, feedback: string, revisionCount: number): Promise<TaskInfo>;
  // Specs and reports
  readSpec(feature: string, id: string): Promise<string | null>;
  writeSpec(feature: string, id: string, content: string): Promise<void>;
  readReport(feature: string, id: string): Promise<string | null>;
  writeReport(feature: string, id: string, content: string): Promise<void>;
  // Verification reports
  readVerification(feature: string, id: string): Promise<VerificationReport | null>;
  writeVerification(feature: string, id: string, report: VerificationReport): Promise<void>;

  // Optional rich methods (BrTaskAdapter implements, FsTaskAdapter returns null/no-op)
  getRichFields?(feature: string, id: string): Promise<RichTaskFields | null>;
  updateRichFields?(feature: string, id: string, fields: Partial<RichTaskFields>): Promise<void>;
  suggestNext?(feature: string, id: string): Promise<TaskInfo[]>;
  addComment?(feature: string, id: string, body: string): Promise<void>;
}

