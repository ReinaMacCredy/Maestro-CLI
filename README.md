# maestro

Agent-optimized development orchestrator.

Plan-first workflow for AI coding agents: features are planned, reviewed, approved, then executed in isolated git worktrees with full context tracking.

## Quick Start

```bash
maestro init                                    # initialize project
maestro feature-create my-feature               # create feature
maestro plan-write --feature my-feature \
  --content "## Discovery\n..."                 # write plan
maestro plan-approve --feature my-feature       # approve plan
maestro task-sync --feature my-feature          # generate tasks
maestro status                                  # see runnable tasks
```

## Prerequisites

- [bun](https://bun.sh) (runtime and package manager)
- [git](https://git-scm.com) (worktree isolation)
- [br](https://github.com/anthropics/beads_rust) (optional -- task tracking backend)

## Building

```bash
bun install           # install dependencies
bun run build         # generate skills registry + compile + standalone binary
```

Produces `./dist/maestro` -- a self-contained binary with no runtime dependencies.

Development mode: `bun src/cli.ts <command>`

## Architecture

Clean architecture with explicit dependency direction:

```
commands/  -->  usecases/  -->  ports/  <--  adapters/
(CLI I/O)       (rules)        (interfaces)  (implementations)
```

### Directory Layout

```
src/
  adapters/     # Port implementations (filesystem, git, br)
  commands/     # One file per CLI command
  lib/          # Cross-cutting: output, errors, signals
  plugins/      # Plugin registry and loader
  ports/        # Interfaces (TaskPort, VcsPort, etc.)
  skills/       # Skill loader and registry generator
  usecases/     # Business rules
  utils/        # Helpers: paths, detection, plan-parser
skills/         # 11 bundled SKILL.md workflow guides
```

## Command Groups

| Domain | Commands | Count |
|--------|----------|-------|
| Feature | create, list, info, active, complete | 5 |
| Plan | write, read, approve, revoke, comment, comments-clear | 6 |
| Task | sync, create, update, list, info, spec-read/write, report-read/write | 9 |
| Subtask | create, update, list, info, delete, spec-read/write, report-read/write | 9 |
| Worktree | start, commit, list, diff, conflicts, cleanup, discard, create | 8 |
| Merge | merge | 1 |
| Context | write, read, list, delete, compile, archive, stats | 7 |
| Session | track, list, master, fork, fresh | 5 |
| Ask | create, answer, list, cleanup | 4 |
| Config | get, set, agent | 3 |
| Other | init, status, agents-md, sandbox-status, sandbox-wrap, skill, skill-list | 7 |
| **Total** | | **64** |

All commands accept `--json` for machine-readable output.

## Skills

11 bundled workflow skills provide phase-specific guidance for AI agents:

| Skill | Purpose |
|-------|---------|
| `writing-plans` | Plan structure and quality |
| `parallel-exploration` | Codebase research strategies |
| `brainstorming` | Feature ideation |
| `executing-plans` | Task execution workflow |
| `dispatching-parallel-agents` | Worker delegation patterns |
| `code-reviewer` | Code review checklist |
| `verification-before-completion` | Pre-completion checks |
| `systematic-debugging` | Root cause analysis |
| `test-driven-development` | TDD workflow |
| `agents-md-mastery` | AGENTS.md management |
| `docker-mastery` | Docker sandbox usage |

Load with `maestro skill <name>`, list with `maestro skill-list`.
