# Handoff Demo Plan

## Discovery

This is a test feature to exercise the maestro handoff pipeline. The goal is to verify that handoff documents are correctly generated and sent to a target agent (Codex). No actual code changes are needed -- this is purely a workflow test to validate inter-agent communication via Agent Mail.

## Implementation

### 1. Create greeting module
Add `src/greeting.ts` with a `greet(name: string): string` function that returns `"Hello, {name}!"`. Export from module index.
**Depends on**: none

### 2. Add tests for greeting module
Unit test for `greet()` with various inputs. Test empty string edge case.
**Depends on**: 1

## Non-Goals
- No production deployment
- No CI/CD integration

## Ghost Diffs
- None expected
