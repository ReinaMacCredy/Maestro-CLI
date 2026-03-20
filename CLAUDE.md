# maestro -- MCP Plugin for Agent-Optimized Development

## Getting Started

At the start of every session, call `maestro_status` (MCP) or `maestro status` (CLI).
Load recommended skills with `maestro_skill('<name>')`.

## Architecture

maestro is a **pure MCP plugin** -- structured memory + workflow guardrails.
Claude Code is the orchestrator (spawning agents natively), maestro is the filing cabinet with opinions.

- **4 task states**: pending, claimed, done, blocked
- **30 MCP tools** across 8 groups
- **Plain file backend** (default), optional br sync
- **Hooks**: SessionStart (pipeline injection), PreToolUse:Agent (task spec injection)
- **Pipeline**: discovery --> research --> planning --> approval --> execution --> done (stages are skippable)

## Workflow Phases

| Phase | Trigger | MCP Tools / CLI Commands |
|-------|---------|--------------------------|
| Discovery | New feature request | `maestro_feature_create`, `maestro_memory_write` |
| Research | Feature exists | Agent subagents, `maestro_memory_write` to capture findings |
| Planning | Research done | `maestro_plan_write`, `maestro_plan_read` |
| Approval | Plan written | `maestro_plan_approve` |
| Execution | Plan approved | `maestro_tasks_sync`, `maestro_task_next`, `maestro_task_claim`, `maestro_task_done` |
| Completion | All tasks done | `maestro_feature_complete`, `maestro_memory_promote` |

## Planning Mode

1. Load `maestro:design` and `maestro:parallel-exploration` skills
2. Research the codebase, save findings with `maestro_memory_write`
3. Write the plan with `maestro_plan_write`
4. Review comments with `maestro_plan_read`
5. Approve with `maestro_plan_approve`

## Execution Mode

1. `maestro_tasks_sync` -- generate tasks from approved plan
2. `maestro_task_next` -- find runnable tasks with compiled specs
3. `maestro_task_claim` -- claim a task for an agent
4. Spawn Agent to implement (pre-agent hook auto-injects spec + worker rules)
5. `maestro_task_done` -- mark complete with summary
6. Repeat until all tasks done

## Blocked Tasks

If a worker hits a blocker:
1. Worker calls `maestro_task_block` with reason
2. Review blocker in `maestro_status`
3. Resolve and call `maestro_task_unblock` with decision

## Stale Claims

Claims expire after `claimExpiresMinutes` (default 120). Expired claims are auto-reset to pending when `maestro_task_next` is called.

## MCP Tools (30)

| Group | Tools |
|-------|-------|
| Feature (3) | `feature_create`, `feature_list`, `feature_complete` |
| Plan (4) | `plan_write`, `plan_read`, `plan_approve`, `plan_comment` |
| Task (7) | `tasks_sync`, `task_next`, `task_claim`, `task_done`, `task_block`, `task_unblock`, `task_list` |
| Memory (4) | `memory_write`, `memory_read`, `memory_list`, `memory_promote` |
| Meta (4) | `status`, `skill`, `ping`, `init` |
| Graph (3) | `graph_insights`, `graph_next`, `graph_plan` |
| Handoff (3) | `handoff_send`, `handoff_receive`, `handoff_ack` |
| Search (2) | `search_sessions`, `search_related` |

All tools are prefixed `maestro_` in MCP (e.g. `maestro_task_claim`).

## CLI Commands

Commands organized by domain:

### Feature (5)
`feature-create`, `feature-list`, `feature-info`, `feature-active`, `feature-complete`

### Plan (6)
`plan-write`, `plan-read`, `plan-approve`, `plan-revoke`, `plan-comment`, `plan-comments-clear`

### Task (8)
`task-sync`, `task-list`, `task-next`, `task-info`, `task-spec-read`, `task-spec-write`, `task-report-read`, `task-report-write`

### Memory (8)
`memory-write`, `memory-read`, `memory-list`, `memory-delete`, `memory-compile`, `memory-archive`, `memory-stats`, `memory-promote`

### Handoff (3)
`handoff-send`, `handoff-receive`, `handoff-ack`

### Graph (3)
`graph-insights`, `graph-next`, `graph-plan`

### Search (2)
`search-sessions`, `search-related`

### Config (3)
`config-get`, `config-set`, `config-agent`

### Other (8)
`init`, `install`, `status`, `agents-md`, `skill`, `skill-list`, `self-update`, `update`

All commands accept `--json`. Use `maestro <command> --help` for full usage.


# TypeScript Style Guide

## Types
- Prefer `interface` for object shapes and `type` for unions or intersections
- Avoid `any`; use `unknown` and narrow with type guards
- Use `readonly` for immutable data
- Prefer `const` assertions for literal types
- Use discriminated unions over optional fields for variant types

## Naming
- Types and interfaces: PascalCase
- Variables and functions: camelCase
- Constants: UPPER_SNAKE_CASE
- Enums: PascalCase for both enum names and members
- Files: kebab-case

## Functions
- Prefer arrow functions for callbacks and short expressions
- Use named functions for top-level declarations
- Add explicit return types for public API functions
- Use function overloads sparingly; prefer union types

## Async
- Always `await` promises; avoid fire-and-forget flows
- Use `Promise.all()` for parallel independent operations
- Handle errors with `try/catch` at the boundary rather than every call site
- Prefer `async/await` over `.then()` chains

## Imports
- Group imports by built-in, external, internal, then relative
- Use named imports instead of `import *`
- Avoid circular dependencies

## Nullability
- Prefer `undefined` over `null`
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Avoid non-null assertions except in tests or tightly constrained cases

## Testing
- Use `describe` and `it` for structure
- Mock external dependencies, not internal modules
- Test error paths in addition to happy paths
