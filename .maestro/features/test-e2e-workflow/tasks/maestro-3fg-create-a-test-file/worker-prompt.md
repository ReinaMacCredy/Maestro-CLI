# Maestro Worker Assignment

You are a worker agent executing task maestro-3fg-create-a-test-file for feature test-e2e-workflow.

## Assignment Details

| Field | Value |
|-------|-------|
| Feature | test-e2e-workflow |
| Task | maestro-3fg-create-a-test-file |
| Task # | 0 |
| Workspace | /Users/reinamaccredy/Code/agent-hive-cc/maestroCLI |

**CRITICAL**: Operate only inside this project checkout:
`/Users/reinamaccredy/Code/agent-hive-cc/maestroCLI`

Do not create worktrees, do not spawn sub-workers, and do not hand work back without calling `maestro task-finish`.

---

## Your Mission

# Task: maestro-3fg-create-a-test-file

## Feature: test-e2e-workflow

## Dependencies

_None_

## Plan Section

### 1. Create a test file
- Create a simple `test-artifact.txt` in the feature context directory
- Validates: task-start, worker prompt generation, task-finish
**Depends on**: none

## Task Type

testing

## Context

## discovery-notes

# Discovery Notes

## What
This is a test feature to validate the full maestro workflow end-to-end.

## Findings
- The CLI plugin responds correctly to status and feature-create calls
- Both mcp__maestro and mcp__hive plugins are available
- No existing features were present before this test

## Decisions
- Using a simple two-task plan to exercise the full lifecycle
- Will test: context-write, plan-write, plan-read, plan-approve, task-sync, task-start, task-finish, feature-complete


---

## Pre-implementation Checklist

Before writing code, confirm:
1. Dependencies are satisfied and required context is present.
2. The exact files/sections to touch are identified.
3. The first failing test to write is clear.
4. The minimal change needed to reach green is planned.

---

## Blocker Protocol

If you hit a blocker requiring human decision, do **not** ask the user directly from this worker.

Instead, run:

```bash
maestro task-finish --task "maestro-3fg-create-a-test-file" --feature "test-e2e-workflow" --status blocked --summary "What you accomplished so far" --blocker-reason "Why you're blocked" --blocker-recommendation "Your suggested choice"
```

After `maestro task-finish` with blocked status, stop immediately.

---

## Completion Protocol

When the task is fully complete:

```bash
maestro task-finish --task "maestro-3fg-create-a-test-file" --feature "test-e2e-workflow" --status completed --summary "Concise summary of what you accomplished"
```

If you encounter an unrecoverable error:

```bash
maestro task-finish --task "maestro-3fg-create-a-test-file" --feature "test-e2e-workflow" --status failed --summary "What went wrong and what was attempted"
```

If you made partial progress but cannot finish:

```bash
maestro task-finish --task "maestro-3fg-create-a-test-file" --feature "test-e2e-workflow" --status partial --summary "What was completed and what remains"
```

After `maestro task-finish`, stop. The orchestrator will interpret the result and decide the next step.

**Summary guidance**:
1. Start with what changed, citing concrete file paths.
2. Mention why only if it matters to later tasks.
3. Include exact verification performed, or say "Not verified".
4. Keep it to 2-4 sentences.
5. Only state facts you directly observed.

---

## TDD Protocol

1. Red: write or update the failing test first
2. Green: make the minimal code change to pass
3. Refactor: clean up while keeping tests green

Do not skip tests unless the task is a pure refactor of already-tested code.

## Debugging Protocol

1. Reproduce
2. Isolate
3. Hypothesize
4. Fix

After 3 failed attempts at the same fix, stop and use the blocker protocol.

---

## Tool Access

Use the normal coding tools plus:
- `maestro plan-read`
- `maestro context-write`
- `maestro task-report-read`
- `maestro task-finish`

Do not use:
- recursive delegation of any kind

---

Begin the task now.
