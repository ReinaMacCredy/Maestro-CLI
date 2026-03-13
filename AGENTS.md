# Agent Guidelines for maestroCLI

## Overview

**maestroCLI** is an agent-optimized CLI orchestrator implementing plan-first development: Plan --> Approve --> Execute. It replaces MCP tool calls with a standalone CLI binary (`maestro`), usable from any AI coding assistant.

## Build and Test

```bash
bun install                # install dependencies
bun run build              # generate skills registry + compile + standalone binary (dist/maestro)
bun test                   # run all tests
bun src/cli.ts             # dev mode (run without compiling)
bun src/cli.ts --version   # verify: prints 0.1.0
```

## Code Style

- **TypeScript ES2022** with ESM modules
- **Semicolons**: yes
- **Quotes**: single quotes
- **Imports**: use `.ts` extension for local imports (bun handles resolution)
- **Type imports**: separate with `import type { X }` syntax
- **Naming**: `camelCase` for variables/functions, `PascalCase` for types/interfaces/classes
- Descriptive function names (`readFeatureJson`, `ensureFeatureDir`)

## Architecture

Clean architecture with explicit dependency direction:

```
commands/  -->  usecases/  -->  ports/  <--  adapters/
(CLI I/O)       (rules)        (interfaces)  (implementations)
```

### Directory Layout

| Directory | Count | Purpose |
|-----------|-------|---------|
| `src/adapters/` | 10 | Port implementations (filesystem, git, br) |
| `src/commands/` | 64 | One file per CLI command (citty `defineCommand`) |
| `src/lib/` | 4 | Cross-cutting: output, errors, signals, truncation |
| `src/plugins/` | 3 | Plugin registry, loader, types |
| `src/ports/` | 4 | Interfaces: tasks, vcs, search, code-intel |
| `src/skills/` | 3 | Skill loader and registry generator |
| `src/usecases/` | 8 | Business rules: merge, sync, approve, commit, etc. |
| `src/utils/` | 13 | Helpers: paths, detection, plan-parser, prompt-budgeting |
| `skills/` | 11 | Bundled SKILL.md files (workflow guidance for agents) |

### Entry Points

- `src/cli.ts` -- CLI entry, defines all 64 subcommands via citty
- `src/services.ts` -- Module-level singleton for service wiring
- `build.ts` -- Build script: skills registry + bun compile + standalone binary

## Key Patterns

### Module-Level Singleton

`services.ts` provides `initServices(directory)` / `getServices()`. Root command calls `initServices` in `setup()`, subcommands call `getServices()`. This sidesteps citty's lack of parent-to-subcommand context propagation.

### Command Definition

All commands use citty's `defineCommand`:

```typescript
import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'example', description: 'Do something' },
  args: { feature: { type: 'string', description: 'Feature name' } },
  async run({ args }) {
    try {
      const { featureAdapter } = getServices();
      const result = await featureAdapter.doSomething(args.feature);
      output(result, formatResult);
    } catch (error) {
      handleCommandError(error);
    }
  },
});
```

### Output

`output(data, formatter)` respects `--json` flag. In JSON mode, prints raw data. In text mode, calls the formatter function.

### Error Handling

`handleCommandError` + `MaestroError` with actionable hints:

```typescript
throw new MaestroError(
  'Feature not found',
  ['Run maestro feature-list to see available features'],
);
```

### Task/Subtask Command Factory

`_task-factory.ts` generates info, update, spec-read, spec-write, report-read, report-write commands for both tasks and subtasks from shared templates. Reduces duplication across 12 commands.

## Adding Features

### New Command

1. Create `src/commands/<name>.ts` using `defineCommand`
2. Add static import in `src/cli.ts`
3. Add entry to `subCommands` map in `src/cli.ts`

### New Adapter

1. Implement the relevant port interface from `src/ports/`
2. Wire into `initServices()` in `src/services.ts`

### New Skill

1. Create `skills/<name>/SKILL.md` with skill instructions
2. Run `bun run build` (regenerates skills registry)

### New Use Case

1. Create `src/usecases/<name>.ts`
2. Depend on ports, not adapters (dependency inversion)
3. Call from the relevant command

## Tests

- Framework: `bun:test`
- Unit tests: `src/__tests__/unit/` -- pure logic (plan-parser, feature-resolution, errors, output, etc.)
- E2E tests: `src/__tests__/e2e/` -- test harness creates temp git repo with `.hive/` directory
- Mocks: `src/__tests__/mocks/` -- `InMemoryTaskPort` for testing without br dependency
- Run: `bun test` or `bun test <file>`

## Commit Messages

Conventional commits:

```
feat: add parallel task execution
fix: handle missing worktree gracefully
refactor: extract worktree logic to adapter
test: add feature resolution unit tests
docs: update skill documentation
chore: upgrade dependencies
simplify: extract shared command factory
perf: cache resolved paths
```
