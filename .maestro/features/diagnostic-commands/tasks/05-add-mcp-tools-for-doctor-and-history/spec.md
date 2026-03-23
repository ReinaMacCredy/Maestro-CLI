# Task: 05-add-mcp-tools-for-doctor-and-history

## Feature: diagnostic-commands

## Dependencies

- **2. Create doctor CLI command** (02-create-doctor-cli-command)
- **4. Create history CLI command** (04-create-history-cli-command)

## Plan Section

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

## Task Type

modification
