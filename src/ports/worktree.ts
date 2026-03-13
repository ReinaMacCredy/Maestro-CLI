/**
 * WorktreePort -- abstract interface for worktree management.
 * Concrete implementation: GitWorktreeAdapter.
 */

import type { WorktreeInfo, DiffResult, ApplyResult, CommitResult, MergeResult } from '../types.ts';

export interface WorktreePort {
  create(feature: string, step: string, baseBranch?: string): Promise<WorktreeInfo>;
  get(feature: string, step: string): Promise<WorktreeInfo | null>;
  getDiff(feature: string, step: string, baseCommit?: string): Promise<DiffResult>;
  exportPatch(feature: string, step: string, baseBranch?: string): Promise<string>;
  applyDiff(feature: string, step: string, baseBranch?: string): Promise<ApplyResult>;
  remove(feature: string, step: string, deleteBranch?: boolean): Promise<void>;
  list(feature?: string): Promise<WorktreeInfo[]>;
  cleanup(feature?: string): Promise<{ removed: string[]; pruned: boolean }>;
  checkConflicts(feature: string, step: string, baseBranch?: string): Promise<string[]>;
  commitChanges(feature: string, step: string, message?: string): Promise<CommitResult>;
  merge(feature: string, step: string, strategy?: 'merge' | 'squash' | 'rebase'): Promise<MergeResult>;
  hasUncommittedChanges(feature: string, step: string): Promise<boolean>;
}
