# maestro

Agent-optimized development orchestrator -- an MCP plugin that gives AI coding agents structured memory, workflow guardrails, and a plan-first pipeline.

Features are discovered, researched, planned, approved, then executed by agents with all state persisted under `.maestro/`.

## Quick Start

```bash
maestro init                                    # initialize project
maestro feature-create my-feature               # create feature
maestro plan-write --feature my-feature \
  --content "## Discovery\n..."                 # write plan
maestro plan-approve --feature my-feature       # approve plan
maestro task-sync --feature my-feature          # generate tasks from plan
maestro task-next --feature my-feature          # find next runnable task
maestro task-claim --feature my-feature \
  --task 01-example                             # claim task for an agent
maestro task-done --feature my-feature \
  --task 01-example --summary "What changed"    # mark task complete
```

## Prerequisites

- [bun](https://bun.sh) (runtime and package manager)
- [git](https://git-scm.com) (repo state and audit capture)

### Optional integrations

The following tools from [Dicklesworthstone](https://github.com/Dicklesworthstone) power optional adapters. maestro degrades gracefully when any are absent.

| Tool | Adapter | Purpose |
|------|---------|---------|
| [br](https://github.com/Dicklesworthstone/beads_rust) (beads_rust) | sync backend | Task tracking and bead persistence |
| [bv](https://github.com/Dicklesworthstone/beads_viewer) (beads viewer) | `bv-graph` | Dependency graph insights, next-task recommendations, execution plans |
| [cass](https://github.com/Dicklesworthstone/coding_agent_session_search) (Coding Agent Session Search) | `cass-search` | Full-text search across coding agent sessions (Claude Code, Codex, Cursor, Gemini) |
| [agent-mail](https://github.com/Dicklesworthstone/mcp_agent_mail) (MCP Agent Mail) | `agent-mail-handoff` | Cross-agent handoff notifications via HTTP API |

## Building

```bash
bun install
bun run build
```

Produces `./dist/cli.js` (CLI) and `./dist/server.bundle.mjs` (MCP server). Development mode: `bun src/cli.ts <command>`.

## Architecture

maestro is a **pure MCP plugin** -- Claude Code is the orchestrator (spawning agents natively), maestro is the filing cabinet with opinions.

```text
commands/  -->  usecases/  -->  ports/  <--  adapters/
(CLI I/O)       (rules)        (interfaces)  (implementations)

server/    -->  usecases/  -->  ports/  <--  adapters/
(MCP tools)     (rules)        (interfaces)  (implementations)
```

```text
src/
  adapters/     # Filesystem, br, graph, search, verification
  commands/     # CLI commands organized by domain
  hooks/        # Claude Code hooks (session-start, pre-agent, pre-compact)
  lib/          # Output, errors, signals, truncation
  plugins/      # Plugin registry and loader (built-in: br, git, rg, tilth)
  ports/        # Interfaces (tasks, plans, features, memory, doctrine, search, graph, handoff)
  server/       # MCP tool registration (one file per domain)
  skills/       # Skill loader and registry generator
  templates/    # Plan scaffolding
  usecases/     # Business rules
  utils/        # Paths, git, plan parser, spec builder
skills/         # Bundled SKILL.md workflow guides
hooks/          # Installable Claude Code hooks
```

### Pipeline

```text
discovery --> research --> planning --> approval --> execution --> done
```

Stages are skippable. Hooks inject pipeline context automatically.

### Task Model

6 states: `pending` --> `claimed` --> `done` | `blocked` | `review` --> `revision`

Stale claims expire after a configurable timeout (default 120 min) and auto-reset to `pending` on `task-next`.

## MCP Tools (39)

All tools are prefixed `maestro_` in MCP (e.g., `maestro_task_claim`).

| Group | Tools | Count |
|-------|-------|-------|
| Feature | `feature_create`, `feature_list`, `feature_complete` | 3 |
| Plan | `plan_write`, `plan_read`, `plan_approve`, `plan_comment` | 4 |
| Task | `tasks_sync`, `task_next`, `task_claim`, `task_done`, `task_accept`, `task_reject`, `task_block`, `task_unblock`, `task_list` | 9 |
| Memory | `memory_write`, `memory_read`, `memory_list`, `memory_promote` | 4 |
| Doctrine | `doctrine_list`, `doctrine_read`, `doctrine_write`, `doctrine_deprecate`, `doctrine_approve` | 5 |
| Meta | `status`, `skill`, `ping`, `init`, `dcp_preview`, `execution_insights` | 6 |
| Graph | `graph_insights`, `graph_next`, `graph_plan` | 3 |
| Handoff | `handoff_send`, `handoff_receive`, `handoff_ack` | 3 |
| Search | `search_sessions`, `search_related` | 2 |

## CLI Commands (58)

All commands accept `--json` for machine-readable output. Use `maestro <command> --help` for full usage.

| Domain | Commands | Count |
|--------|----------|-------|
| Feature | create, list, info, active, complete | 5 |
| Plan | write, read, approve, revoke, comment, comments-clear | 6 |
| Task | sync, list, next, info, claim, done, block, unblock, spec-read, spec-write, report-read, report-write | 12 |
| Memory | write, read, list, delete, compile, archive, stats, promote | 8 |
| Doctrine | list, read, write, deprecate, suggest, approve | 6 |
| Graph | insights, next, plan | 3 |
| Handoff | send, receive, ack | 3 |
| Search | sessions, related | 2 |
| Config | get, set, agent | 3 |
| Other | init, install, ping, status, agents-md, skill, skill-list, dcp-preview, self-update, update | 10 |

## Hooks

Installable Claude Code hooks that integrate maestro into the agent lifecycle:

| Hook | Trigger | Purpose |
|------|---------|---------|
| SessionStart | Session begins | Inject pipeline state and recommended skills |
| PreToolUse:Agent | Before agent spawn | Inject task spec into worker prompt |
| PostToolUse | After tool execution | Track tool usage and state changes |
| PreCompact | Before context compaction | Preserve critical maestro state |

Install with `maestro install`.

## Skills

18 bundled workflow skills, all using `maestro:` colon-prefixed naming:

- `maestro:design` -- deep discovery and specification (16-step process with reference files)
- `maestro:implement` -- task execution with TDD, parallel, and team modes
- `maestro:review` -- track-aware code review with automated checks
- `maestro:brainstorming` -- creative exploration before implementation
- `maestro:parallel-exploration` -- parallel read-only exploration
- `maestro:dispatching` -- parallel agent dispatch
- `maestro:debugging` -- systematic debugging methodology
- `maestro:tdd` -- test-driven development guidance
- `maestro:verification` -- verification before completion
- `maestro:agents-md` -- AGENTS.md quality discipline and generation
- `maestro:docker` -- Docker container workflows
- `maestro:prompt-leverage` -- prompt engineering for AI agents
- `maestro:new-feature` -- create feature/bug tracks with spec and plan
- `maestro:note` -- capture decisions and context to persistent notepad
- `maestro:plan-review-loop` -- iterative adversarial plan review
- `maestro:revert` -- git-aware undo of track implementation
- `maestro:setup` -- scaffold project context
- `maestro:status` -- track progress overview

Load with `maestro skill <name>`, list with `maestro skill-list`.

Skills with `reference/` subdirectories support progressive disclosure:
```
maestro skill maestro:design --ref steps/step-01-init.md
```

Old skill names (e.g., `writing-plans`) are aliased with deprecation warnings.

## Data Layout

```text
.maestro/
  config.json                           # Project configuration
  doctrine/                             # Doctrine items (cross-feature operating rules)
    <name>.json                         # Structured rule with effectiveness metrics
  memory/                               # Global project-scoped memory files
  features/
    <feature>/
      feature.json                      # Feature metadata and state
      plan.md                           # Implementation plan
      comments.json                     # Plan review comments
      memory/                           # Feature-scoped memory files
      tasks/
        <task>/
          task.json                     # Task state, claims, summaries
          spec.md                       # Compiled task specification
          report.md                     # Task completion report
          doctrine-trace.json           # Doctrine injection trace (Phase 4)
```

## License

MIT
