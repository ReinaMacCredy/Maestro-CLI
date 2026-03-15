# maestro Design

## Core Concept

Context-driven development for AI coding assistants.

```text
PROBLEM  -->  CONTEXT  -->  EXECUTION  -->  REPORT
(why)         (what)        (how)           (shape)
```

All durable state lives under `.maestro/`.

## Data Structure

```text
.maestro/
  features/
    {feature}/
      feature.json
      plan.md
      comments.json
      context/
        research.md
        decisions.md
      tasks/
        {task}/
          spec.md
          worker-prompt.md
          session.json
          report.md
```

## Architecture

```text
commands/  -->  usecases/  -->  ports/  <--  adapters/
(CLI I/O)       (rules)        (interfaces)  (implementations)
```

- Commands parse args and format output.
- Use cases own workflow rules.
- Ports define task storage boundaries.
- Adapters implement filesystem, br, worker runner, sandbox, and AGENTS.md behavior.

## Task Lifecycle

```text
pending --> in_progress --> done
                       \-> blocked --> in_progress
                       \-> partial --> in_progress
                       \-> failed --> pending
                       \-> cancelled --> pending
```

## Direct Worker Execution

- `task-start` generates `spec.md` and `worker-prompt.md`, records `baseCommit`, creates `session.json`, and launches the configured worker CLI in the main repo checkout.
- `session.json` is the live session sidecar for heartbeat, attempt count, pid, launcher, and exit information.
- `task-finish` writes `report.md`, updates task state, and records git audit data (`baseCommit`, `HEAD`, dirty state, changed files, uncommitted files).
- Only one task may be `in_progress` at a time.

## Stale Detection

- `status` treats an `in_progress` task with a stale heartbeat as a zombie/stale task.
- Missing `session.json` on an `in_progress` task is treated as stale.
- Recovery path: `task-start --force` marks the stale attempt failed and starts a new attempt from the current checkout state.

## Worker Prompt Building

`task-start` generates a worker prompt at `.maestro/features/{feature}/tasks/{task}/worker-prompt.md` containing:

- task spec and dependency context
- prior completed-task summaries
- relevant context files
- blocker/completion protocol using `task-finish`

Prompt budgeting still caps prior-task and context payloads to keep workers within context limits.

## Source Of Truth

| File | Purpose |
|------|---------|
| `feature.json` | feature metadata and lifecycle |
| `plan.md` | approved execution plan |
| `comments.json` | plan review comments |
| `spec.md` | generated task context |
| `worker-prompt.md` | worker instructions |
| `session.json` | live worker session sidecar |
| `report.md` | completion summary and audit trail |

## Key Principles

- No worktree isolation
- Single-writer execution in the main checkout
- Durable prompt, report, and session artifacts
- Direct launcher abstraction for `codex` and `claude`
- Feature/task context must survive agent restarts
