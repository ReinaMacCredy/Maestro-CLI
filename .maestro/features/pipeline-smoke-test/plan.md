## Discovery

This is a pipeline smoke test to verify all maestro tools function correctly end-to-end.
The test creates a minimal feature with two tasks: one creates a test artifact file,
the other depends on the first and verifies it exists. This exercises dependency ordering,
task state transitions, and the full feature lifecycle. All 34 MCP tools are called in sequence.

## Implementation

### 1. Create smoke test artifact

Create a file at `.maestro/features/pipeline-smoke-test/memory/smoke-artifact.md` with a brief markdown summary confirming the smoke test passed.

### 2. Verify smoke test artifact

**Depends on**: 1

Read the file created in task 1 and confirm it contains the expected content.

## Non-Goals

- No production code changes
- No external service calls
- No persistent state changes beyond the smoke test feature directory

## Ghost Diffs

None expected.