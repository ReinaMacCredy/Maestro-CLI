/**
 * Mock WorktreePort for unit testing use cases.
 * Tracks calls for assertion and allows per-method overrides.
 */

import type { WorktreePort } from '../../ports/worktree.ts';
import type { WorktreeInfo, DiffResult, ApplyResult, CommitResult, MergeResult } from '../../types.ts';

export interface MockWorktreeCalls {
  remove: any[][];
  merge: any[][];
  checkConflicts: any[][];
  commitChanges: any[][];
}

export function createMockWorktreeAdapter(
  overrides: Partial<WorktreePort> = {},
): WorktreePort & { calls: MockWorktreeCalls } {
  const calls: MockWorktreeCalls = {
    remove: [],
    merge: [],
    checkConflicts: [],
    commitChanges: [],
  };

  return {
    calls,

    create: overrides.create ?? (async (_f: string, _s: string): Promise<WorktreeInfo> => ({
      path: '/tmp/wt',
      branch: 'test-branch',
      commit: 'abc123',
      feature: _f,
      step: _s,
    })),

    get: overrides.get ?? (async () => null),

    getDiff: overrides.getDiff ?? (async (): Promise<DiffResult> => ({
      hasDiff: false,
      diffContent: '',
      filesChanged: [],
      insertions: 0,
      deletions: 0,
    })),

    exportPatch: overrides.exportPatch ?? (async () => ''),

    applyDiff: overrides.applyDiff ?? (async (): Promise<ApplyResult> => ({
      success: true,
      filesAffected: [],
    })),

    remove: overrides.remove ?? (async (_f: string, _t: string, _d?: boolean) => {
      calls.remove.push([_f, _t, _d]);
    }),

    list: overrides.list ?? (async () => []),

    cleanup: overrides.cleanup ?? (async () => ({ removed: [], pruned: false })),

    checkConflicts: overrides.checkConflicts ?? (async (_f: string, _t: string) => {
      calls.checkConflicts.push([_f, _t]);
      return [];
    }),

    commitChanges: overrides.commitChanges ?? (async (_f: string, _t: string, _msg?: string): Promise<CommitResult> => {
      calls.commitChanges.push([_f, _t, _msg]);
      return { committed: true, sha: 'abc123' };
    }),

    merge: overrides.merge ?? (async (_f: string, _t: string, _s?: string): Promise<MergeResult> => {
      calls.merge.push([_f, _t, _s]);
      return {
        success: true,
        merged: true,
        sha: 'def456',
        filesChanged: ['src/widget.ts', 'src/api.ts'],
      };
    }),

    hasUncommittedChanges: overrides.hasUncommittedChanges ?? (async () => false),
  };
}
