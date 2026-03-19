# Status Output Templates

Concrete output examples for each feature phase and condition. Use these as formatting references when presenting status to the user.

---

## Discovery Phase

Feature exists but no plan has been written yet.

```
# maestro status

feature: my-feature [planning]
plan:    none
tasks:   0/0 done
memory:  3 files, ~2400 bytes

--> No plan yet. Start with `maestro:brainstorming` to explore the idea,
    then write the plan with `maestro_plan_write`.
```

**What to emphasize**: Memory files (if any exist, the user has been doing discovery work). Suggest brainstorming or design skills. Do not show empty task sections.

---

## Planning Phase -- Draft With No Comments

Plan exists as a draft, no review comments yet.

```
# maestro status

feature: my-feature [planning]
plan:    draft
tasks:   0/0 done

--> Plan is drafted. Review it with `maestro_plan_read`.
    When satisfied, approve with `maestro_plan_approve`.
```

---

## Planning Phase -- Draft With Unreviewed Comments

Plan has review comments that need attention.

```
# maestro status

feature: my-feature [planning]
plan:    draft (3 comments)
tasks:   0/0 done

[~] 3 unreviewed comments on the plan.
    Read them: `maestro_plan_read`
    Address the feedback, revise the plan, then approve.
```

**What to emphasize**: Comment count is the key signal. Comments on a draft plan mean someone (or a previous session) left feedback. These must be addressed before approval.

---

## Pre-Execution Phase -- Plan Approved, No Tasks

Plan is approved but tasks have not been synced yet.

```
# maestro status

feature: my-feature [approved]
plan:    approved
tasks:   0/0 done

--> Plan approved. Generate tasks: `maestro_tasks_sync`
```

**What to emphasize**: This is a single-action state. The only thing to do is sync tasks. Keep the output minimal.

---

## Execution Phase -- Healthy Progress

Tasks are running with no problems detected.

```
# maestro status

feature: my-feature [executing]
plan:    approved
tasks:   3/8 done, 1 claimed, 4 pending
  [done]      001-setup-schema
  [done]      002-create-adapter
  [done]      003-write-port
  [claimed]   004-implement-usecase
  [pending]   005-add-validation
  [pending]   006-wire-cli-command
  [pending]   007-integration-tests
  [pending]   008-update-docs

--> Task 004-implement-usecase is claimed and being worked on.
    Use `maestro_task_next` to check for additional runnable tasks.
```

**What to emphasize**: Progress fraction and the claimed task. Show full task list with status alignment. Done tasks can be collapsed if there are many (10+).

---

## Execution Phase -- Blocked Task

A task is blocked and requires a user decision.

```
# maestro status

feature: my-feature [executing]
plan:    approved
tasks:   2/6 done, 0 claimed, 3 pending
  [done]      001-setup-schema
  [done]      002-create-adapter
  [blocked]   003-api-integration
  [pending]   004-validation-logic
  [pending]   005-error-handling
  [pending]   006-tests

[!] Task 003-api-integration is BLOCKED.
    Read the blocker: `maestro task-report-read --task 003-api-integration`
    Unblock with decision: `maestro_task_unblock` with the task ID and your decision.
```

**What to emphasize**: Blocked tasks get `[!]` markers and appear in a separate callout above the next-action. The user must make a decision before progress can continue on this task or its dependents.

---

## Execution Phase -- Stale Claim (Zombie)

A task is `claimed` but the claim has expired -- no worker is actively running.

```
# maestro status

feature: my-feature [executing]
plan:    approved
tasks:   1/5 done, 1 claimed (stale), 3 pending
  [done]      001-setup-schema
  [claimed]   002-create-adapter  (claim expired)
  [pending]   003-api-integration
  [pending]   004-validation
  [pending]   005-tests

[!] Stale claim detected: 002-create-adapter
    The claim on this task has expired -- no worker is running.
    Run `maestro_task_next` to auto-reset it to pending, then re-claim.
```

**What to emphasize**: Stale claims are the highest-priority problem. They block progress because the task appears claimed but no worker is actually running. The `maestro_task_next` tool automatically resets expired claims to `pending`. Call it to clear the stale claim, then claim the task fresh.

---

## Execution Phase -- Multiple Runnable Tasks

Several tasks are ready to claim, with no current work in progress.

```
# maestro status

feature: my-feature [executing]
plan:    approved
tasks:   3/8 done, 0 claimed, 5 pending
  [done]      001-setup-schema
  [done]      002-create-adapter
  [done]      003-write-port
  [pending]   004-implement-usecase
  [pending]   005-add-validation
  [pending]   006-wire-cli-command
  [pending]   007-integration-tests
  [pending]   008-update-docs

--> 3 tasks are runnable: 004-implement-usecase, 005-add-validation, 006-wire-cli-command
    Use `maestro_task_next` to get the recommended task with its compiled spec,
    then claim it with `maestro_task_claim`.
```

---

## Execution Phase -- All Pending But Dependency-Blocked

All tasks are pending and none are runnable due to dependency chains.

```
# maestro status

feature: my-feature [executing]
plan:    approved
tasks:   0/4 done, 0 claimed, 4 pending
  [pending]   001-setup-schema
  [pending]   002-create-adapter (depends on: 001-setup-schema)
  [pending]   003-api-integration (depends on: 002-create-adapter)
  [pending]   004-tests (depends on: 003-api-integration)

--> Start the first task in the dependency chain:
    `maestro_task_claim` task 001-setup-schema
```

---

## Completion Phase

All tasks are done.

```
# maestro status

feature: my-feature [executing]
plan:    approved
tasks:   6/6 done
  [done]      001-setup-schema
  [done]      002-create-adapter
  [done]      003-api-integration
  [done]      004-validation
  [done]      005-error-handling
  [done]      006-tests
memory:  5 files, ~8200 bytes

--> All tasks complete. Review the implementation, then mark the feature done:
    `maestro_feature_complete`
```

**What to emphasize**: Completion is a clean state. Show the done count, memory file count (as a record of decisions made), and the single next action. Collapse the task list if there are many done tasks (show count only).

---

## Compound Condition -- Stale Claim + Blocked

Multiple problems coexist. Prioritize by severity.

```
# maestro status

feature: my-feature [executing]
plan:    approved
tasks:   2/7 done, 1 claimed (stale), 4 pending
  [done]      001-setup-schema
  [done]      002-create-adapter
  [claimed]   003-api-integration  (claim expired)
  [blocked]   004-validation
  [pending]   005-error-handling
  [pending]   006-cli-command
  [pending]   007-tests

[!] STALE CLAIM: 003-api-integration -- claim expired, no worker running.
    Run `maestro_task_next` to auto-reset to pending, then re-claim.

[!] BLOCKED: 004-validation -- waiting on a decision.
    After clearing the stale claim, read the blocker:
    `maestro task-report-read --task 004-validation`
    Then unblock: `maestro_task_unblock` with your decision.

    Address problems in priority order: stale claims first, then blocked tasks.
```

**What to emphasize**: When multiple conditions coexist, list them in severity order (stale claim > blocked). Number them or use explicit ordering language ("first", "then", "after that") so the user knows the sequence.

---

## Formatting Reference

### Status Markers

| Marker | Meaning                          | Used For                               |
|--------|----------------------------------|----------------------------------------|
| `[!]`  | High severity, blocks progress   | Stale claims, blocked tasks            |
| `[~]`  | Medium severity, needs attention | Plan comments                          |
| `-->`  | Informational, suggested action   | Next steps, recommendations            |
| `[ok]` | Healthy state                    | Optional, for explicit confirmation    |

### Task Status Labels

| Label       | Meaning                                  |
|-------------|------------------------------------------|
| `[pending]` | Not yet started, waiting to be claimed   |
| `[claimed]` | Actively being worked on by a worker     |
| `[done]`    | Completed successfully                   |
| `[blocked]` | Waiting on a decision to proceed         |

### Collapsing Rules

- **Done tasks**: If more than 8 done tasks, collapse to a single line: `[done] 12 tasks completed`
- **Pending tasks**: Always show individually (the user needs to see what is coming)
- **Problem tasks**: Never collapse. Always show individually with full context.
- **Memory files**: Show count and bytes only. Do not list individual files.

### Progress Indicators

For execution phase, include a progress fraction:

- `3/8 done (37%)` -- simple and scannable
- Do not use ASCII progress bars unless specifically requested
