# Plan: test-e2e-workflow

## Discovery

This feature validates the full maestro CLI workflow from feature creation through completion. During discovery, we confirmed both MCP plugins (maestro and hive) respond correctly, no prior features existed, and the directory structure is created properly. The goal is to exercise every lifecycle phase to catch any broken commands before real usage.

## Overview

A simple two-task plan to validate the task lifecycle (sync, start, finish) and feature completion.

### 1. Create a test file
- Create a simple `test-artifact.txt` in the feature context directory
- Validates: task-start, worker prompt generation, task-finish
**Depends on**: none

### 2. Remove the test file
- Remove the artifact created in task 1
- Validates: task dependencies, sequential execution, feature-complete
**Depends on**: 1

## Non-Goals

- Testing the hive plugin (separate test)
- Testing concurrent/parallel task execution
- Testing blocked task recovery flow

## Ghost Diffs

- No production code will be changed
- All artifacts are confined to `.maestro/features/test-e2e-workflow/`