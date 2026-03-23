# Task: 04-create-history-cli-command

## Feature: diagnostic-commands

## Dependencies

- **3. Create history use-case and tests** (03-create-history-use-case-and-tests)

## Plan Section

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

## Task Type

greenfield
