# maestro -- Agent-Optimized Development Orchestrator

## Getting Started

At the start of every session:

```bash
maestro status
maestro skill <name>
```

## Workflow Phases

| Phase | Trigger | Commands |
|-------|---------|----------|
| Discovery | New feature request | `maestro feature-create <name>`, `maestro context-write --feature <name> --name <file> --content "..."` |
| Planning | Feature exists, no plan | `maestro plan-write --feature <name> --content "..."`, `maestro plan-read --feature <name>` |
| Approval | Plan written | `maestro plan-approve --feature <name>` |
| Execution | Plan approved | `maestro task-sync --feature <name>`, `maestro task-start --feature <name> --task <id>` |
| Completion | All tasks done | `maestro feature-complete --feature <name>` |

## Planning Mode

1. Load `writing-plans` and `parallel-exploration`
2. Ask clarifying questions about the feature
3. Research the codebase and save findings with `context-write`
4. Write the plan with `plan-write`
5. Review comments with `plan-read`
6. Approve with `plan-approve`

## Execution Mode

1. `maestro task-sync --feature <name>`
2. `maestro status`
3. Start the next runnable task with `maestro task-start --feature <name> --task <id>`
4. Let the worker CLI read and follow `.maestro/features/<feature>/tasks/<task>/worker-prompt.md`
5. The worker finishes with `maestro task-finish`
6. Repeat until all tasks are done

## Blocked Or Partial Tasks

If a worker reports a blocker:

1. Review the blocker in `task-report-read`
2. Get the user decision
3. Resume with:

```bash
maestro task-start --feature <name> --task <id> --continue-from blocked --decision "user's answer"
```

For partial work:

```bash
maestro task-start --feature <name> --task <id> --continue-from partial
```

## Stale Tasks

If `status` shows a stale task, recover it with:

```bash
maestro task-start --feature <name> --task <id> --force
```

This marks the stale attempt failed and starts a new attempt from the current checkout state.

## Command Reference

61 commands organized by domain:

### Feature (5)

`feature-create`, `feature-list`, `feature-info`, `feature-active`, `feature-complete`

### Plan (6)

`plan-write`, `plan-read`, `plan-approve`, `plan-revoke`, `plan-comment`, `plan-comments-clear`

### Task (11)

`task-sync`, `task-create`, `task-update`, `task-list`, `task-info`, `task-start`, `task-finish`, `task-spec-read`, `task-spec-write`, `task-report-read`, `task-report-write`

### Subtask (9)

`subtask-create`, `subtask-update`, `subtask-list`, `subtask-info`, `subtask-delete`, `subtask-spec-read`, `subtask-spec-write`, `subtask-report-read`, `subtask-report-write`

### Context (7)

`context-write`, `context-read`, `context-list`, `context-delete`, `context-compile`, `context-archive`, `context-stats`

### Session (7)

`session-track`, `session-list`, `session-master`, `session-fork`, `session-fresh`, `session-end`, `session-info`

### Ask (4)

`ask-create`, `ask-answer`, `ask-list`, `ask-cleanup`

### Config (3)

`config-get`, `config-set`, `config-agent`

### Other (9)

`init`, `status`, `agents-md`, `sandbox-status`, `sandbox-wrap`, `skill`, `skill-list`, `self-update`, `update`

All commands accept `--json`. Use `maestro <command> --help` for full usage.
