# Plan: Add --verbose Flag to Status Command

## Overview
Add a `--verbose` / `-v` flag to `maestro status` that shows full task descriptions (planTitle + summary) instead of truncated folder names.

## Non-Goals
- Verbose mode for other commands (future work)
- Changing JSON output format (already includes all fields)
- Adding new data fields to TaskInfo

## Phase 1: Implementation (1 task)

### Task 1: Add verbose flag and expand task output
**Files:** `src/commands/status/show.ts`
**Acceptance criteria:**
- Add `verbose: { type: "boolean", alias: "v", description: "Show full task descriptions" }` to command args
- When `--verbose` is set:
  - Show `planTitle` on a second line under each task
  - Show `summary` (prefixed with `-->`) on a third line when present
  - Skip `truncateList` cap (show all tasks)
- When `--verbose` is NOT set: behavior unchanged
- `--json` output is unaffected (TaskInfo already has these fields)

**Dependencies:** None
**Estimated changes:** ~15 lines in show.ts

## Phase 2: Verification (1 task)

### Task 2: Add tests for verbose output
**Files:** `src/__tests__/commands/status.test.ts`
**Acceptance criteria:**
- Test: `--verbose` shows planTitle for all tasks
- Test: `--verbose` shows summary when present, omits when empty
- Test: `--verbose` disables truncation
- Test: without `--verbose`, output is unchanged
- Test: `--json` output is identical with and without `--verbose`

**Dependencies:** Task 1

## Rollback
Single commit, revert if needed. No migration, no config changes, no external dependencies.
