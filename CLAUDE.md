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


# maestro -- MCP Plugin for Agent-Optimized Development

## Getting Started

At the start of every session, call `maestro_status` (MCP) or `maestro status` (CLI).
The status response includes a `playbook` field with stage-specific tools, skills, objectives, and anti-patterns.
Load recommended skills from `playbook.skills` with `maestro_skill('<name>')`.
`skills.recommended` is also present for backward compatibility.

## Architecture

maestro is a **pure MCP plugin** -- structured memory + workflow guardrails.
Claude Code is the orchestrator (spawning agents natively), maestro is the filing cabinet with opinions.

- **6 task states**: pending, claimed, done, blocked, review, revision
- **26 MCP tools** (17 merged action-based + 9 standalone) across 13 groups
- **Plain file backend** (default), optional br sync
- **Hooks**: SessionStart (pipeline injection), PreToolUse:Agent (task spec injection)
- **Doctrine Compiler**: cross-feature learning from execution history, injected into workers via separate budget
- **Pipeline**: discovery --> research --> planning --> approval --> execution --> done (stages are skippable)
- **DCP budgets**: token-based (chars/4 estimation). Config supports both `*BudgetTokens` (preferred) and `*BudgetBytes` (backward compat, auto-derives tokens)
- **Skill stages**: built-in and external skills declare their pipeline stage via `stage:` frontmatter. Playbook auto-discovers external skills tagged for the current stage.

## Workflow Phases

| Phase | Trigger | MCP Tools / CLI Commands |
|-------|---------|--------------------------|
| Discovery | New feature request | `maestro_feature action:create`, `maestro_memory action:write` |
| Research | Feature exists | Agent subagents, `maestro_memory action:write` to capture findings |
| Planning | Research done | `maestro_plan action:write`, `maestro_plan_read` |
| Approval | Plan written | `maestro_plan action:approve` |
| Execution | Plan approved | `maestro_task action:sync`, `maestro_task_read what:next`, `maestro_task action:claim`, `maestro_task action:done` |
| Completion | All tasks done | `maestro_feature action:complete`, `maestro_memory action:promote`, `maestro_doctrine action:approve` |

## Planning Mode

1. Load `maestro:design` and `maestro:parallel-exploration` skills
2. Research the codebase, save findings with `maestro_memory action:write`
3. Write the plan with `maestro_plan action:write`
4. Review comments with `maestro_plan_read`
5. Approve with `maestro_plan action:approve`

## Execution Mode

1. `maestro_task action:sync` -- generate tasks from approved plan
2. `maestro_task_read what:next` -- find runnable tasks with compiled specs
3. `maestro_task action:claim` -- claim a task for an agent
4. Spawn Agent to implement (pre-agent hook auto-injects spec + worker rules)
5. `maestro_task action:done` -- mark complete with summary
6. Repeat until all tasks done

## Blocked Tasks

If a worker hits a blocker:
1. Worker calls `maestro_task action:block` with reason
2. Review blocker in `maestro_status`
3. Resolve and call `maestro_task action:unblock` with decision

## Stale Claims

Claims expire after `claimExpiresMinutes` (default 120). Expired claims are auto-reset to pending when `maestro_task_next` is called.

## MCP Tools (26)

Tools use `action` (mutating) or `what` (read-only) params to route within each merged tool.

| Tool | Type | Actions / What |
|------|------|----------------|
| `maestro_feature` | mutating | action: create, complete |
| `maestro_feature_read` | read-only | what: list, info, active |
| `maestro_plan` | mutating | action: write, approve, revoke, comment, comments_clear |
| `maestro_plan_read` | read-only | (reads plan + comments) |
| `maestro_task` | mutating | action: sync, claim, done, accept, reject, block, unblock, spec_write, report_write |
| `maestro_task_read` | read-only | what: list, info, spec, report, next, brief |
| `maestro_memory` | mutating | action: write, delete, promote, compress, consolidate, connect, archive |
| `maestro_memory_read` | read-only | what: read, list, stats, insights, compile |
| `maestro_doctrine` | mutating | action: write, approve, suggest, deprecate |
| `maestro_doctrine_read` | read-only | what: list, read |
| `maestro_handoff` | mutating | action: send, ack |
| `maestro_handoff_read` | read-only | what: read, list, status, receive |
| `maestro_skill` | read-only | action: load, list, install, create, remove, sync |
| `maestro_graph` | mutating | action: insights, next, plan, discovery, reserve |
| `maestro_search` | read-only | action: sessions, related, similar |
| `maestro_visual` | mutating | type: any visualization type |
| `maestro_dcp` | read-only | action: preview, stats, config |
| `maestro_stage` | mutating | action: jump, skip, back |
| `maestro_status` | read-only | (standalone) |
| `maestro_ping` | read-only | (standalone) |
| `maestro_init` | mutating | (standalone) |
| `maestro_doctor` | read-only | (standalone) |
| `maestro_history` | read-only | (standalone) |
| `maestro_execution_insights` | read-only | (standalone) |
| `maestro_config_get` | read-only | (standalone) |
| `maestro_config_set` | mutating | (standalone) |

All tools are prefixed `maestro_` in MCP.

## CLI Commands (70)

Commands organized by domain:

### Feature (5)
`feature-create`, `feature-list`, `feature-info`, `feature-active`, `feature-complete`

### Plan (6)
`plan-write`, `plan-read`, `plan-approve`, `plan-revoke`, `plan-comment`, `plan-comments-clear`

### Task (12)
`task-sync`, `task-list`, `task-next`, `task-info`, `task-claim`, `task-done`, `task-block`, `task-unblock`, `task-spec-read`, `task-spec-write`, `task-report-read`, `task-report-write`

### Memory (9)
`memory-write`, `memory-read`, `memory-list`, `memory-delete`, `memory-compile`, `memory-consolidate`, `memory-archive`, `memory-stats`, `memory-promote`

### Handoff (3)
`handoff-send`, `handoff-receive`, `handoff-ack`

### Graph (3)
`graph-insights`, `graph-next`, `graph-plan`

### Search (2)
`search-sessions`, `search-related`

### Doctrine (6)
`doctrine-list`, `doctrine-read`, `doctrine-write`, `doctrine-deprecate`, `doctrine-suggest`, `doctrine-approve`

### Config (3)
`config-get`, `config-set`, `config-agent`

### Toolbox (6)
`toolbox-add`, `toolbox-create`, `toolbox-install`, `toolbox-list`, `toolbox-remove`, `toolbox-test`

### Visual (2)
`visual`, `debug-visual`

### Other (13)
`init`, `install`, `status`, `agents-md`, `skill`, `skill-list`, `dcp-preview`, `ping`, `doctor`, `history`, `execution-insights`, `self-update`, `update`

All commands accept `--json`. Use `maestro <command> --help` for full usage.
