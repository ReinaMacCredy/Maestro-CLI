# maestro Design

## Core Concept

Context-Driven Development for AI coding assistants.

```
PROBLEM  -->  CONTEXT  -->  EXECUTION  -->  REPORT
(why)         (what)        (how)           (shape)
```

Every decision, constraint, and finding is persisted to `.hive/` so agents can resume with full context across sessions.

## Data Structure

```
.hive/
  features/
    {feature}/
      feature.json          # metadata and state
      plan.md               # approved execution plan
      tasks.json            # task list with status
      contexts/             # persistent knowledge files
        research.md
        decisions.md
      tasks/
        {task}/
          status.json       # task state
          spec.md           # task context and requirements
          worker-prompt.md  # full worker prompt (generated)
          report.md         # execution summary and results
  .worktrees/
    {feature}/{task}/       # isolated git worktrees per task
```

## Architecture

Clean architecture with explicit dependency direction:

```
commands/  -->  usecases/  -->  ports/  <--  adapters/
(CLI I/O)       (rules)        (interfaces)  (implementations)
```

### Layers

**Commands** (64 files) -- CLI entry points using citty's `defineCommand`. Parse args, call use cases or adapters, format output. No business logic.

**Use Cases** (8 files) -- Business rules: merge-task, start-task, write-plan, sync-plan, approve-plan, complete-feature, commit-task, check-status. Depend on ports, never on adapters.

**Ports** (1 interface) -- Boundaries: `TaskPort` (task CRUD). Defined as a TypeScript interface.

**Adapters** (10 files) -- Implementations: filesystem-based feature/plan/context/session/config/ask adapters, git worktree adapter, br task adapter, agents-md adapter, docker sandbox adapter.

### Module Wiring

`services.ts` provides a module-level singleton (`initServices` / `getServices`). The root CLI command calls `initServices(projectRoot)` in its `setup()` hook. Subcommands call `getServices()` to access adapters.

This pattern works around citty's limitation of not propagating parent context to subcommands.

## Task Lifecycle

```
pending --> in_progress --> done
                       \-> blocked --> (resume) --> done
                       \-> failed
                       \-> partial
                       \-> cancelled
```

### Status Vocabulary

| Status | Description |
|--------|-------------|
| `pending` | Not started |
| `in_progress` | Currently being worked on |
| `done` | Completed successfully |
| `blocked` | Waiting for user decision (blocker protocol) |
| `failed` | Execution failed |
| `partial` | Partially completed |
| `cancelled` | Cancelled by user |

### Blocker Protocol

When a worker encounters a decision it cannot make:

1. Worker calls `maestro worktree-commit --status blocked --blocker "..."` with reason, options, recommendation
2. Orchestrator sees blocker in `maestro status`
3. Orchestrator asks user for decision
4. Orchestrator resumes: `maestro worktree-create --continueFrom blocked --decision "answer"`
5. New worker spawns in the same worktree with previous progress preserved

## Feature Resolution

All commands use detection-based feature resolution:

1. **Explicit parameter** -- `--feature <name>` always wins
2. **Worktree detection** -- detect from cwd path (`.hive/.worktrees/{feature}/{task}/`)
3. **Single-feature fallback** -- if only one feature exists, use it
4. **Error** -- if multiple features exist, require explicit `--feature`

This enables multi-session support (parallel agents on different features) and worktree detection (agent knows its feature from its working directory).

## Worker Prompt Building

`maestro worktree-start` generates a complete worker prompt at `.hive/features/{feature}/tasks/{task}/worker-prompt.md` containing:

- Task spec (name, description, dependencies)
- Prior task summaries (what came before)
- Upcoming tasks (what comes after)
- Relevant context files
- Workflow protocols and guidelines

### Prompt Budgeting

Defaults: last 10 tasks, 2000 chars per summary, 20KB per context file, 60KB total budget. The `promptMeta`, `payloadMeta`, and `warnings` fields in the response report actual sizes and any truncation applied.

## Worktree Isolation

Each task executes in an isolated git worktree:

- Full repo copy at `.hive/.worktrees/{feature}/{task}/`
- Agent makes changes freely without affecting main branch
- On `worktree-commit`: changes committed to task branch
- On `merge`: task branch merged into main
- On `worktree-discard`: worktree removed, no changes applied

## Source of Truth

| File | Owner | Other Access |
|------|-------|-------------|
| `feature.json` | Orchestrator | Read-only |
| `tasks.json` | Orchestrator | Read-only |
| `status.json` | Worker | Orchestrator (read) |
| `plan.md` | Orchestrator | Read + comment |
| `spec.md` | `worktree-start` / `worktree-create` | Worker (read-only) |
| `report.md` | Worker | All (read-only) |

## Key Principles

- **No global state** -- all commands accept explicit feature parameter
- **Detection-first** -- worktree path reveals feature context
- **Isolation** -- each task in its own worktree, safe to discard
- **Audit trail** -- every action logged to `.hive/`
- **Agent-friendly** -- minimal overhead during execution
- **Context persists** -- write to `.hive/` files; memory is ephemeral
