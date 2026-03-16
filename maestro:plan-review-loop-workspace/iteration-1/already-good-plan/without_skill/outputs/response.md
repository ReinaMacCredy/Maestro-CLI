# Plan Review: Add --verbose Flag to Status Command

## Review Findings

### [!] Issue 1: Wrong test file path (Task 2)

The plan specifies `src/__tests__/commands/status.test.ts`, but the test directory has no `commands/` subdirectory. All tests live under `src/__tests__/unit/` or `src/__tests__/e2e/`. The correct path should be `src/__tests__/unit/status-verbose.test.ts` (or similar, following existing naming conventions like `check-status.test.ts`).

### [!] Issue 2: Missing Discovery section

The project workflow requires a `## Discovery` section (minimum 100 chars) in every plan. This plan omits it entirely. A brief discovery section documenting what was investigated (e.g., confirming `TaskInfo` already has `planTitle` and `summary` fields, confirming `truncateList` usage in `show.ts`) would satisfy this requirement and provide useful context for workers.

### [ok] Verified: TaskInfo fields exist

The plan claims "TaskInfo already has these fields" -- confirmed. `planTitle?: string` and `summary?: string` are both optional fields on the `TaskInfo` interface in `src/types.ts` (lines 82-83).

### [ok] Verified: truncateList usage

`show.ts` imports `truncateList` from `../../lib/truncation.ts` and applies it with a hardcoded cap of 20. The plan correctly identifies this as the behavior to bypass in verbose mode.

### [ok] Verified: Scope and non-goals are appropriate

Single-file implementation change (~15 lines), no type changes needed, JSON output unaffected. Clean scope.

### [ok] Verified: Task dependency ordering

Task 2 (tests) correctly depends on Task 1 (implementation).

### [ok] Verified: Rollback strategy

Single commit, no migrations or config changes. Revert is trivial.

---

## Changes Made

Two issues were identified and corrected in the plan below.

---

## Corrected Plan

# Plan: Add --verbose Flag to Status Command

## Discovery

Investigated `src/commands/status/show.ts` and confirmed it uses `truncateList` (imported from `../../lib/truncation.ts`) with a hardcoded cap of 20 items. The `TaskInfo` interface in `src/types.ts` already includes optional `planTitle` and `summary` fields (lines 82-83), so no type changes are needed. Existing tests live under `src/__tests__/unit/` -- there is no `src/__tests__/commands/` directory.

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

**Files:** `src/__tests__/unit/status-verbose.test.ts`
**Acceptance criteria:**
- Test: `--verbose` shows planTitle for all tasks
- Test: `--verbose` shows summary when present, omits when empty
- Test: `--verbose` disables truncation
- Test: without `--verbose`, output is unchanged
- Test: `--json` output is identical with and without `--verbose`

**Dependencies:** Task 1

## Rollback

Single commit, revert if needed. No migration, no config changes, no external dependencies.
