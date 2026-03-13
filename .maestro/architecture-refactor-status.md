# Architecture Refactor Status

## Merged to main (pushed to origin)

| # | Unit | Commit | Notes |
|---|------|--------|-------|
| 1 | Split paths.ts -> paths + fs-io + locking | merged | 13 files changed |
| 2 | Create port interfaces (5 ports) | merged | FeaturePort, PlanPort, ContextPort, WorktreePort, SessionPort |
| 4 | lib/utils boundary cleanup | merged (pre-filter-branch) | resolve-feature moved to utils/, feature-resolution renamed to dependency-check |
| 7 | Enable TypeScript strict mode | merged | tsconfig strict:true, minimal type fixes |

## Still TODO (lost during git filter-branch rewrite)

| # | Unit | Description | Effort |
|---|------|-------------|--------|
| 3 | Worker namespace consolidation | Move 5 files from utils/ to utils/worker/ (worker-launch, worker-prompt, prompt-budgeting, prompt-file, spec-builder) + update all imports | ~30 min |
| 6 | Command registry codegen | Create commands/generate.ts, auto-generate registry.generated.ts, simplify cli.ts | ~30 min |

## Not needed

| # | Unit | Notes |
|---|------|-------|
| 5 | Remove dead ports | Files already absent from codebase |

## Current state

- 156 tests pass, 0 fail
- Build succeeds (129 modules, standalone binary)
- All 68 CLI commands functional
- TypeScript strict mode enabled
- Hexagonal architecture completed (5 new port interfaces)
- paths.ts split into 3 focused modules
