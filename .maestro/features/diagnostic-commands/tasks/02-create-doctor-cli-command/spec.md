# Task: 02-create-doctor-cli-command

## Feature: diagnostic-commands

## Dependencies

- **1. Create doctor use-case and tests** (01-create-doctor-use-case-and-tests)

## Plan Section

### 2. Create doctor CLI command
**Depends on**: 1

**Files:**
- Create: `src/commands/doctor/run.ts`

**What to do**:
1. Create `src/commands/doctor/run.ts` using `defineCommand`
2. No args needed (or optional `--verbose` boolean for detailed output)
3. In `run()`: call `getServices()`, pass to `doctor()` use-case
4. Format output: green/yellow/red status per check, summary line at bottom
5. `output(report, formatDoctor)` for JSON support
6. Run `bun run build` to regenerate command registry
7. Test manually: `bun src/cli.ts doctor`

**Verify**:
- `bun run build` --> succeeds
- `bun src/cli.ts doctor` --> prints check results
- `bun src/cli.ts doctor --json` --> valid JSON output

## Phase 2: `maestro history` command

## Task Type

greenfield
