---
name: maestro:simplify
description: "Review changed code for reuse, quality, and efficiency, then fix issues found. Use after implementing a task or feature -- catches duplication, hacky patterns, and wasted work before review."
argument-hint: "[--staged | --task <task-id> | --feature <feature-name>]"
stage: execution
audience: worker
---

# Simplify -- Code Review and Cleanup

Review all changed files for reuse, quality, and efficiency. Fix any issues found.

## Arguments

`$ARGUMENTS`

- `--staged`: Review only staged changes (`git diff --cached`)
- `--task <task-id>`: Review changes from a specific maestro task (uses task branch diff)
- `--feature <feature-name>`: Review all changes across a feature's completed tasks
- No args: review uncommitted changes via `git diff` (or `git diff HEAD` if staged changes exist)

---

## Phase 1: Identify Changes

Determine the diff to review based on arguments:

1. **`--task`**: Load task metadata from `.maestro/features/*/tasks/<task-id>/`. Diff the task branch against main.
2. **`--feature`**: Load feature from `.maestro/features/<name>/`. Aggregate diffs from all completed task branches.
3. **`--staged`**: `git diff --cached`
4. **No args**: `git diff` (or `git diff HEAD` if staged changes exist). If no git changes at all, review the most recently modified files mentioned or edited earlier in this conversation.

If the diff is empty, report "Nothing to simplify." and stop.

## Phase 2: Launch Three Review Agents in Parallel

Use the Agent tool to launch all three agents concurrently in a single message. Pass each agent the full diff so it has the complete context.

### Agent 1: Code Reuse Review

For each change:

1. **Search for existing utilities and helpers** that could replace newly written code. Look for similar patterns elsewhere in the codebase -- common locations are utility directories, shared modules, and files adjacent to the changed ones.
2. **Flag any new function that duplicates existing functionality.** Suggest the existing function to use instead.
3. **Flag any inline logic that could use an existing utility** -- hand-rolled string manipulation, manual path handling, custom environment checks, ad-hoc type guards, and similar patterns are common candidates.

### Agent 2: Code Quality Review

Review the same changes for hacky patterns:

1. **Redundant state**: state that duplicates existing state, cached values that could be derived, observers/effects that could be direct calls
2. **Parameter sprawl**: adding new parameters to a function instead of generalizing or restructuring existing ones
3. **Copy-paste with slight variation**: near-duplicate code blocks that should be unified with a shared abstraction
4. **Leaky abstractions**: exposing internal details that should be encapsulated, or breaking existing abstraction boundaries
5. **Stringly-typed code**: using raw strings where constants, enums (string unions), or branded types already exist in the codebase
6. **Unnecessary comments**: comments explaining WHAT the code does (well-named identifiers already do that), narrating the change, or referencing the task/caller -- delete; keep only non-obvious WHY (hidden constraints, subtle invariants, workarounds)
7. **AI slop**: defensive checks abnormal for the area, swallowed errors, silent fallbacks, TypeScript escape hatches (`as any`, `as unknown as X`) without necessity, style drift from surrounding code

### Agent 3: Efficiency Review

Review the same changes for efficiency:

1. **Unnecessary work**: redundant computations, repeated file reads, duplicate network/API calls, N+1 patterns
2. **Missed concurrency**: independent operations run sequentially when they could run in parallel
3. **Hot-path bloat**: new blocking work added to startup or per-request/per-render hot paths
4. **Recurring no-op updates**: state/store updates inside polling loops, intervals, or event handlers that fire unconditionally -- add a change-detection guard so downstream consumers aren't notified when nothing changed. Also: if a wrapper function takes an updater/reducer callback, verify it honors same-reference returns (or whatever the "no change" signal is) -- otherwise callers' early-return no-ops are silently defeated
5. **Unnecessary existence checks**: pre-checking file/resource existence before operating (TOCTOU anti-pattern) -- operate directly and handle the error
6. **Memory**: unbounded data structures, missing cleanup, event listener leaks
7. **Overly broad operations**: reading entire files when only a portion is needed, loading all items when filtering for one

## Phase 3: Fix Issues

Wait for all three agents to complete. Aggregate their findings and fix each issue directly. If a finding is a false positive or not worth addressing, note it and move on -- do not argue with the finding, just skip it.

When done, briefly summarize what was fixed (or confirm the code was already clean).

## Phase 4: Verify

After applying fixes:

1. Run the project's build/typecheck command to confirm nothing broke
2. Run tests if they exist and are fast (< 60s)
3. If either fails, fix the regression before reporting

---

## Relationship to Other Skills

- **maestro:review** -- Full-ceremony feature review against spec and plan. Use `/simplify` for quick cleanup passes; use `/review` for formal sign-off.
- **maestro:tdd** -- Test-driven development. `/simplify` does not add tests; it assumes tests exist and focuses on code quality.
- **maestro:implement** -- Execution skill. Run `/simplify` after implementing to catch issues before committing or review.

Recommended workflow: implement --> simplify --> commit --> review.
