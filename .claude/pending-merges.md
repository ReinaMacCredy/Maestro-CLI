# Pending Merges from Architecture Audit Session

Another session is currently merging branches. These worktree branches
from the architecture audit batch are ready to merge after the current
session finishes.

## Ready to Merge

### 1. commitTask + mergeTask orchestration tests
- **Branch**: `worktree-agent-a0dfa817`
- **Files**: `src/__tests__/unit/commit-task.test.ts` (new), `src/__tests__/unit/merge-task.test.ts` (new)
- **Tests**: 17 new tests (9 commit-task, 8 merge-task), all passing
- **Conflict risk**: None (new files only)

### 2. Fix approve() dual-write race condition
- **Branch**: `worktree-agent-ab158f9a`
- **Files**: `src/adapters/fs-plan.ts`, `src/usecases/approve-plan.ts`, `src/usecases/write-plan.ts`, `src/commands/plan-revoke.ts`
- **Change**: Removed direct feature.json writes from FsPlanAdapter.approve()/revokeApproval(); routed through FsFeatureAdapter.updateStatus() for proper locking
- **Conflict risk**: MEDIUM -- if the other session also modified fs-plan.ts or approve-plan.ts (adding port interfaces), this will conflict. Resolve by keeping the port interface changes AND the approve fix (remove feature.json writes from approve/revoke, add updateStatus calls in usecases).

### 3. syncPlan orchestration tests
- **Branch**: `worktree-agent-a4ad4a18`
- **PR**: https://github.com/ReinaMacCredy/Maestro-CLI/pull/1
- **Files**: `src/__tests__/unit/sync-plan.test.ts` (new, 281 lines, 9 tests)
- **Conflict risk**: None (new file only)

## Needs Redo (worktree cleaned up)

### 4. Delete dead port interfaces
- **Files to delete**: `src/ports/vcs.ts`, `src/ports/search.ts`, `src/ports/code-intel.ts`
- **NOTE**: If the other session added port interfaces, check whether these 3 are still dead code before deleting. They had zero importers as of the audit.
- Also update `docs/DESIGN.md` and `README.md` to remove references to deleted ports.
