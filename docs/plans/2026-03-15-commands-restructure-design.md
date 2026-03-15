# Commands Directory Restructure

## Problem

`src/commands/` mixes 9 domain subdirectories with 10 flat files. No consistent rule for where a command lives. As commands grow, the flat files become a junk drawer.

## Design Decision

**1:1 noun directories, verb filenames, zero loose files.**

Every command domain gets a directory. Every action is a file named after the verb. Infrastructure lives in `_internal/`.

## Final Structure

```
commands/
  _internal/       task-factory, generate, registry.generated
  agents-md/       generate
  ask/             answer, cleanup, create, list
  config/          agent, get, set
  context/         archive, compile, delete, list, read, stats, write
  feature/         active, complete, create, info, list
  init/            run
  plan/            approve, comment, comments-clear, read, revoke, write
  sandbox/         status, wrap
  session/         end, fork, fresh, info, list, master, track
  skill/           load, list
  status/          show
  subtask/         create, delete, info, list, report-*, spec-*, update
  task/            create, finish, info, list, report-*, spec-*, start, sync, update
  update/          run, self
```

## Rules

- **Where does command X go?** `commands/<noun>/<verb>.ts`
- **Shared command infrastructure?** `commands/_internal/`
- **New command domain?** `mkdir commands/<noun>/`, add `<verb>.ts`
- **Single-command domains** use a descriptive verb: `run`, `show`, `generate` -- not `index` or the noun repeated

## File Moves

| From | To |
|---|---|
| `_task-factory.ts` | `_internal/task-factory.ts` |
| `generate.ts` | `_internal/generate.ts` |
| `registry.generated.ts` | `_internal/registry.generated.ts` |
| `agents-md.ts` | `agents-md/generate.ts` |
| `init.ts` | `init/run.ts` |
| `skill.ts` | `skill/load.ts` |
| `skill-list.ts` | `skill/list.ts` |
| `status.ts` | `status/show.ts` |
| `update.ts` | `update/run.ts` |
| `self-update.ts` | `update/self.ts` |

## Import Updates Required

1. `_internal/registry.generated.ts` -- all flat-file import paths change
2. `_internal/generate.ts` -- registry output path changes
3. `task/*.ts` + `subtask/*.ts` -- `_task-factory` import path changes to `../_internal/task-factory`
4. `cli.ts` -- registry import path changes
5. Regenerate registry after moves

## Non-Goals

- Reorganizing `lib/` or `adapters/`
- Changing command names or CLI interface
- Modifying command implementations
