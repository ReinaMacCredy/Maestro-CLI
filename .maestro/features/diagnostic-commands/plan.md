# Plan: diagnostic-commands

## Discovery

Explored the maestroCLI codebase to understand CLI command registration, service architecture, and output patterns. Commands use citty's `defineCommand`, live in `src/commands/<domain>/`, and are auto-registered by a build-time generator. Services are accessed via `getServices()` singleton providing all ports/adapters. Output uses dual text/JSON mode via `output(data, formatter)`. The `ping` command is the closest existing pattern for health checks; `search-sessions` and `feature-list` are closest for historical queries. Both new commands follow established conventions exactly.

## Phase 1: `maestro doctor` command

### 1. Create doctor use-case and tests
**Depends on**: none

**Files:**
- Create: `src/use-cases/doctor.ts`
- Test: `src/__tests__/unit/doctor.test.ts`

**What to do**:
1. Write failing test: `doctor()` returns a `DoctorReport` with checks array (each: name, status ok/warn/fail, message)
2. Implement use-case that checks:
   - Config file exists and parses (`configAdapter.get()`)
   - Active feature resolvable (`featureAdapter.active()`)
   - Task backend reachable (`taskPort.list()` on active feature)
   - Optional integrations detected: graphPort, handoffPort, searchPort, doctrinePort (present/absent)
3. Return `{ checks: Check[], summary: { ok: number, warn: number, fail: number } }`
4. Run tests, verify pass

**Verify**:
- `bun test src/__tests__/unit/doctor.test.ts` --> all pass

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

### 3. Create history use-case and tests
**Depends on**: none

**Files:**
- Create: `src/use-cases/history.ts`
- Test: `src/__tests__/unit/history.test.ts`

**What to do**:
1. Write failing test: `history()` returns array of `FeatureRecord` with name, status, taskStats, dates
2. Implement use-case:
   - `featureAdapter.list()` to get all features
   - For each feature: read feature metadata (status, created date)
   - For completed features: count tasks by state, compute duration (created --> completed)
   - Sort by most recent first
   - Accept `limit` param (default 10)
3. Return `{ features: FeatureRecord[], total: number }`
4. Run tests, verify pass

**Verify**:
- `bun test src/__tests__/unit/history.test.ts` --> all pass

### 4. Create history CLI command
**Depends on**: 3

**Files:**
- Create: `src/commands/history/run.ts`

**What to do**:
1. Create `src/commands/history/run.ts` using `defineCommand`
2. Args: `--limit` (number, default 10), `--status` (string, filter by status)
3. In `run()`: call `getServices()`, pass to `history()` use-case
4. Format as table: name | status | tasks (done/total) | created | duration
5. `output(result, formatHistory)` for JSON support
6. Run `bun run build` to regenerate command registry
7. Test manually: `bun src/cli.ts history`

**Verify**:
- `bun run build` --> succeeds
- `bun src/cli.ts history` --> prints feature table
- `bun src/cli.ts history --json` --> valid JSON output
- `bun src/cli.ts history --limit 5` --> shows max 5 entries

## Phase 3: MCP tool wiring

### 5. Add MCP tools for doctor and history
**Depends on**: 2, 4

**Files:**
- Modify: MCP tool registration file

**What to do**:
1. Register `maestro_doctor` MCP tool calling the doctor use-case
2. Register `maestro_history` MCP tool calling the history use-case with limit param
3. Run build, verify tools register

**Verify**:
- `bun run build` --> succeeds

## Non-Goals
- No persistent storage for history (reads existing feature metadata only)
- No fix/remediation actions from doctor (report only, not auto-fix)
- No external service health checks (only local ports/adapters)

## Ghost Diffs
- Do not modify existing commands
- Do not change the service initialization pattern
- Do not add new dependencies
