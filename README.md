# maestro

Agent-optimized development orchestrator.

Plan-first workflow for AI coding agents: features are planned, reviewed, approved, then executed by direct worker CLI launches in the main repo checkout with prompt, report, and session tracking persisted under `.maestro/`.

## Quick Start

```bash
maestro init                                    # initialize project
maestro feature-create my-feature               # create feature
maestro plan-write --feature my-feature \
  --content "## Discovery\n..."                 # write plan
maestro plan-approve --feature my-feature       # approve plan
maestro task-sync --feature my-feature          # generate tasks
maestro task-start --feature my-feature --task 01-example
```

Workers finish with:

```bash
maestro task-finish --feature my-feature --task 01-example --status completed --summary "What changed and how it was verified"
```

## Prerequisites

- [bun](https://bun.sh) (runtime and package manager)
- [git](https://git-scm.com) (repo state and audit capture)
- [br](https://github.com/anthropics/beads_rust) (optional task tracking backend)
- a supported worker CLI on `PATH`: `codex` or `claude`

## Building

```bash
bun install
bun run build
```

Produces `./dist/maestro`, a self-contained binary. Development mode: `bun src/cli.ts <command>`.

## Architecture

```text
commands/  -->  usecases/  -->  ports/  <--  adapters/
(CLI I/O)       (rules)        (interfaces)  (implementations)
```

Directory layout:

```text
src/
  adapters/     # Filesystem, br, worker runner, sandbox
  commands/     # One file per CLI command
  lib/          # Output, errors, signals
  plugins/      # Plugin registry and loader
  ports/        # Interfaces (TaskPort)
  skills/       # Skill loader and registry generator
  usecases/     # Business rules
  utils/        # Paths, detection, prompt/session helpers
skills/         # Bundled SKILL.md workflow guides
```

## Command Groups

| Domain | Commands | Count |
|--------|----------|-------|
| Feature | create, list, info, active, complete | 5 |
| Plan | write, read, approve, revoke, comment, comments-clear | 6 |
| Task | sync, create, update, list, info, start, finish, spec-read/write, report-read/write | 11 |
| Subtask | create, update, list, info, delete, spec-read/write, report-read/write | 9 |
| Context | write, read, list, delete, compile, archive, stats | 7 |
| Session | track, list, master, fork, fresh, end, info | 7 |
| Ask | create, answer, list, cleanup | 4 |
| Config | get, set, agent | 3 |
| Other | init, status, agents-md, sandbox-status, sandbox-wrap, skill, skill-list, self-update, update | 9 |
| **Total** | | **61** |

All commands accept `--json` for machine-readable output.

## Direct Worker Execution

- `task-start` launches the configured worker CLI in the main project checkout.
- Live worker state is tracked in `.maestro/features/<feature>/tasks/<task>/session.json`.
- `task-finish` writes the durable task report and git audit summary.
- Only one task may be `in_progress` at a time.
- Stale `in_progress` tasks are surfaced by `maestro status` and can be recovered with `task-start --force`.

## Skills

Bundled workflow skills include:

- `writing-plans`
- `parallel-exploration`
- `brainstorming`
- `executing-plans`
- `code-reviewer`
- `verification-before-completion`
- `systematic-debugging`
- `test-driven-development`
- `agents-md-mastery`
- `docker-mastery`

Load with `maestro skill <name>`, list with `maestro skill-list`.
