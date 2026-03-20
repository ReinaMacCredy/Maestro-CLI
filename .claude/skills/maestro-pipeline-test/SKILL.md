---
name: maestro-pipeline-test
description: Run a full end-to-end smoke test of all 30 maestro MCP tools AND the CLI commands in a single session. Use this skill when testing the maestro pipeline, verifying tool installation, validating a maestro setup, or checking that all tool groups work (feature, plan, task, memory, meta, graph, handoff, search). Trigger on "test maestro", "smoke test", "pipeline test", "verify all tools", "run pipeline test", or whenever the user wants to confirm maestro is functioning correctly -- even if they just say "does it work?" in a maestro context.
---

# Maestro Pipeline Smoke Test

This skill exercises all 30 maestro MCP tools AND the CLI commands in a single end-to-end run. It creates a throwaway feature, walks through every pipeline stage, tests every tool group via both MCP and CLI, and produces a pass/fail report.

The test is designed to be fast and non-destructive. The smoke-test feature it creates can be cleaned up afterward.

## Before You Start

Call `maestro_ping` to confirm the MCP server is reachable. If it fails, stop and tell the user -- nothing else will work.

### Setup: Switch to br backend

The pipeline runs on the `br` (Beads Rust) task backend by default. Record the current backend, then switch to `br`:

| Step | Action | Verify |
|------|--------|--------|
| 0.1 | `maestro config-get --key taskBackend --json` | Record original value (may be `"fs"` or `"br"`) |
| 0.2 | `maestro config-set --key taskBackend --value br` | No error |
| 0.3 | `maestro ping --json` | `taskBackend` is `"br"` AND `integrations.br` is `true` |

If step 0.3 shows `integrations.br: false` (br CLI not installed), abort the pipeline and tell the user: "br is required for the pipeline test. Install Beads Rust or run with `--fs-only` to test the fs backend instead."

## The Pipeline

Run each phase in order. After each tool call, check that the response is not an error. Record pass/fail for each tool. If a tool fails, note the error but continue to the next tool -- the goal is to test coverage, not to bail on first failure.

Use the feature name `pipeline-smoke-test` throughout. If it already exists from a prior run, tell the user and ask whether to reuse or clean up first.

### Phase 1: Meta Tools

| Step | Tool | Parameters | Verify |
|------|------|------------|--------|
| 1.1 | `maestro_ping` | (none) | Response has `version` and `backend` |
| 1.2 | `maestro_status` | `{ verbose: true }` | Response has `pipelineStage` |
| 1.3 | `maestro_skill` | `{ name: "maestro:design" }` | Returns skill content (non-empty string) |
| 1.4 | `maestro_init` | (none) | Response has `projectRoot` |

### Phase 2: Feature + Memory

| Step | Tool | Parameters | Verify |
|------|------|------------|--------|
| 2.1 | `maestro_feature_create` | `{ name: "pipeline-smoke-test" }` | Response has `feature` with name matching |
| 2.2 | `maestro_feature_list` | (none) | `pipeline-smoke-test` appears in list |
| 2.3 | `maestro_memory_write` | `{ name: "discovery-notes", content: "Smoke test discovery: verified maestro tools are accessible and feature was created." }` | Response has `path` |
| 2.4 | `maestro_memory_read` | `{ name: "discovery-notes" }` | Content matches what was written |
| 2.5 | `maestro_memory_list` | (none) | `discovery-notes` appears in list |

### Phase 3: Plan Lifecycle

Use this exact plan content -- it has the required `## Discovery` section and generates two tasks with a dependency:

```markdown
## Discovery

This is a pipeline smoke test to verify all maestro tools function correctly end-to-end.
The test creates a minimal feature with two tasks: one creates a test artifact file,
the other depends on the first and verifies it exists. This exercises dependency ordering,
task state transitions, and the full feature lifecycle. All 30 MCP tools are called in sequence.

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
```

| Step | Tool | Parameters | Verify |
|------|------|------------|--------|
| 3.1 | `maestro_plan_write` | `{ content: <plan above> }` | Response has `plan` with status |
| 3.2 | `maestro_plan_comment` | `{ body: "Smoke test comment: plan looks good for pipeline validation.", author: "smoke-test" }` | Response has `comment` |
| 3.3 | `maestro_plan_read` | (none) | Plan content is present, comment count >= 1 |
| 3.4 | `maestro_plan_approve` | (none) | Plan status changes to approved |

### Phase 4: Task Lifecycle

This is the most tool-dense phase. It exercises all 7 task tools and tests the full state machine: pending --> claimed --> blocked --> pending --> claimed --> done.

| Step | Tool | Parameters | Verify |
|------|------|------------|--------|
| 4.1 | `maestro_tasks_sync` | (none) | Tasks are generated (count >= 2) |
| 4.2 | `maestro_task_list` | (none) | Shows tasks with pending status |
| 4.3 | `maestro_task_next` | (none) | Returns at least one runnable task; note its `folder` value |
| 4.4 | `maestro_task_claim` | `{ task: <folder from 4.3>, agent_id: "smoke-test-agent" }` | Task status changes to claimed |
| 4.5 | `maestro_task_block` | `{ task: <same folder>, reason: "Smoke test: intentional block to test state transition" }` | Task status changes to blocked |
| 4.6 | `maestro_task_unblock` | `{ task: <same folder>, decision: "Smoke test: unblocking to continue pipeline test" }` | Task status changes back to pending |
| 4.7 | `maestro_task_claim` | `{ task: <same folder>, agent_id: "smoke-test-agent" }` | Task status changes to claimed again |
| 4.8 | `maestro_task_done` | `{ task: <same folder>, summary: "Smoke test: task completed as part of pipeline validation" }` | Task status changes to done |

Now complete the second task (which depends on the first):

| Step | Tool | Parameters | Verify |
|------|------|------------|--------|
| 4.9 | `maestro_task_next` | (none) | Second task is now runnable (dependency met) |
| 4.10 | `maestro_task_claim` | `{ task: <second task folder>, agent_id: "smoke-test-agent" }` | Claimed |
| 4.11 | `maestro_task_done` | `{ task: <second task folder>, summary: "Smoke test: verified dependency ordering works" }` | Done |

### Phase 4b: Task Backend Switch (br -> fs -> br)

Tests hot-swap from br to the optional fs backend and back. Verifies fs still works as a fallback.

| Step | Action | Verify |
|------|--------|--------|
| 4b.1 | `maestro config-get --key taskBackend --json` | Returns `"br"` (current primary) |
| 4b.2 | `maestro config-set --key taskBackend --value fs` | No error |
| 4b.3 | `maestro ping --json` | `taskBackend` is `"fs"` |
| 4b.4 | `maestro task-list --feature pipeline-smoke-test --all --json` | Returns array with the 2 done tasks from Phase 4 (fs reads from local .maestro/ files) |
| 4b.5 | `maestro task-next --feature pipeline-smoke-test --json` | Returns object with `tasks` array (empty is OK -- all tasks done) |
| 4b.6 | `maestro config-set --key taskBackend --value br` | No error |
| 4b.7 | `maestro ping --json` | `taskBackend` is `"br"`, `integrations.br` is `true` |

### Phase 5: Memory Promotion + Feature Completion

| Step | Tool | Parameters | Verify |
|------|------|------------|--------|
| 5.1 | `maestro_memory_promote` | `{ name: "discovery-notes" }` | Response has `promotedTo` path |
| 5.2 | `maestro_feature_complete` | (none) | Feature marked as completed |
| 5.3 | `maestro_feature_list` | (none) | Feature shows completed status |

### Phase 6: Conditional Tools

These tools depend on external CLIs. Try each one -- if it returns an error about the tool not being available, record "skipped (not available)" instead of "fail". The smoke test should distinguish between "tool exists but broke" (fail) and "tool not registered" (skip).

**Graph tools** (require `bv` CLI):

| Step | Tool | Parameters | Verify |
|------|------|------------|--------|
| 6.1 | `maestro_graph_insights` | (none) | Returns insights or "not available" |
| 6.2 | `maestro_graph_next` | (none) | Returns recommendation or "not available" |
| 6.3 | `maestro_graph_plan` | `{ agents: 2 }` | Returns tracks or "not available" |

**Handoff tools** (require Agent Mail):

| Step | Tool | Parameters | Verify |
|------|------|------------|--------|
| 6.4 | `maestro_handoff_send` | `{ feature: "pipeline-smoke-test", task: <first task folder>, target_agent: "smoke-test-receiver" }` | Sent or "not available". If Agent Mail is running, verify `agentMailSent: true`. If `false`, record as `[!!]` with note about Agent Mail connectivity. |
| 6.5 | `maestro_handoff_receive` | `{ feature: "pipeline-smoke-test", agent_id: "smoke-test-receiver" }` | Returns handoffs array or "not available" |
| 6.6 | `maestro_handoff_ack` | `{ thread_id: <from 6.5 if available> }` | Acknowledged or "not available" |

**Search tools** (require `cass` CLI):

| Step | Tool | Parameters | Verify |
|------|------|------------|--------|
| 6.7 | `maestro_search_sessions` | `{ query: "smoke test", limit: 3 }` | Returns results array or "not available" |
| 6.8 | `maestro_search_related` | `{ file_path: "CLAUDE.md", limit: 3 }` | Returns results array or "not available" |

### Phase 7: CLI Commands

After the MCP pipeline, verify the CLI layer works too. Run each command via `maestro <command> --json` (using `bunx tsx src/cli.ts` if `maestro` binary isn't in PATH). The feature was completed in Phase 5, so create a fresh throwaway feature `cli-smoke-test` for commands that need an active feature.

**Setup:**

| Step | Command | Verify |
|------|---------|--------|
| 7.0 | `maestro feature-create cli-smoke-test --json` | Feature created |

**Task commands** (need plan + tasks):

| Step | Command | Verify |
|------|---------|--------|
| 7.1 | `maestro task-next --feature cli-smoke-test --json` | Returns runnable tasks or empty (no plan yet is fine -- confirms command runs) |

**Memory commands:**

| Step | Command | Verify |
|------|---------|--------|
| 7.2 | `maestro memory-promote --feature cli-smoke-test --name discovery-notes --json` | Promotes or returns error if no memory (confirms command runs) |

**Handoff commands:**

| Step | Command | Verify |
|------|---------|--------|
| 7.3 | `maestro handoff-send --feature cli-smoke-test --task dummy-task --json` | Sends or returns task-not-found (confirms command runs) |
| 7.4 | `maestro handoff-receive --agent-id smoke-test-agent --json` | Returns handoffs array or empty |
| 7.5 | `maestro handoff-ack --thread-id dummy-thread --json` | Returns ack or not-found (confirms command runs) |

**Graph commands:**

| Step | Command | Verify |
|------|---------|--------|
| 7.6 | `maestro graph-insights --json` | Returns insights or "bv not available" |
| 7.7 | `maestro graph-next --json` | Returns recommendation or "bv not available" |
| 7.8 | `maestro graph-plan --json` | Returns tracks or "bv not available" |

**Search commands:**

| Step | Command | Verify |
|------|---------|--------|
| 7.9 | `maestro search-sessions --query "smoke test" --json` | Returns results or "cass not available" |
| 7.10 | `maestro search-related --file CLAUDE.md --json` | Returns results or "cass not available" |

**Cleanup:**

| Step | Command | Verify |
|------|---------|--------|
| 7.11 | `rm -rf .maestro/features/cli-smoke-test` | CLI test feature removed |

For CLI commands, the distinction between "command exists but returned an error about missing data" (pass -- the command is wired up) vs "command not found or crashes" (fail) is what matters. We're testing that the CLI layer is properly connected, not re-testing business logic already covered by MCP.

## Reporting

After all phases complete, produce a summary report like this:

```
MAESTRO PIPELINE SMOKE TEST RESULTS
====================================

Phase 0: Setup (br backend)
  [ok] 0.1 config-get ............. original: "fs"
  [ok] 0.2 config-set ............. switched to br
  [ok] 0.3 ping ................... taskBackend: "br", integrations.br: true

Phase 1: Meta Tools
  [ok] 1.1 ping ................... version: X.Y.Z
  [ok] 1.2 status ................. stage: discovery
  [ok] 1.3 skill .................. loaded maestro:design
  [ok] 1.4 init ................... projectRoot: /path/to/project

Phase 2: Feature + Memory
  [ok] 2.1 feature_create ......... pipeline-smoke-test
  [ok] 2.2 feature_list ........... 2 features found
  [ok] 2.3 memory_write ........... discovery-notes saved
  [ok] 2.4 memory_read ............ content verified
  [ok] 2.5 memory_list ............ 1 memory file

Phase 3: Plan Lifecycle
  [ok] 3.1 plan_write ............. plan saved
  [ok] 3.2 plan_comment ........... comment added
  [ok] 3.3 plan_read .............. 1 comment found
  [ok] 3.4 plan_approve ........... plan approved

Phase 4: Task Lifecycle
  [ok] 4.1 tasks_sync ............. 2 tasks generated
  [ok] 4.2 task_list .............. 2 pending
  [ok] 4.3 task_next .............. task-1 runnable
  [ok] 4.4 task_claim ............. task-1 claimed
  [ok] 4.5 task_block ............. task-1 blocked
  [ok] 4.6 task_unblock ........... task-1 unblocked
  [ok] 4.7 task_claim ............. task-1 re-claimed
  [ok] 4.8 task_done .............. task-1 done
  [ok] 4.9 task_next .............. task-2 runnable
  [ok] 4.10 task_claim ............ task-2 claimed
  [ok] 4.11 task_done ............. task-2 done

Phase 4b: Task Backend Switch (br -> fs -> br)
  [ok] 4b.1 config-get ............. taskBackend: "br"
  [ok] 4b.2 config-set ............. switched to fs
  [ok] 4b.3 ping ................... taskBackend: "fs"
  [ok] 4b.4 task-list (fs) ......... 2 done tasks (local files)
  [ok] 4b.5 task-next (fs) ......... returned object
  [ok] 4b.6 config-set ............. restored to br
  [ok] 4b.7 ping ................... taskBackend: "br"

Phase 5: Promotion + Completion
  [ok] 5.1 memory_promote ......... promoted to global
  [ok] 5.2 feature_complete ....... completed
  [ok] 5.3 feature_list ........... verified

Phase 6: Conditional Tools
  [--] 6.1 graph_insights ......... skipped (bv not available)
  [--] 6.2 graph_next ............. skipped (bv not available)
  [--] 6.3 graph_plan ............. skipped (bv not available)
  [!!] 6.4 handoff_send ........... FAIL: timeout
  [--] 6.5 handoff_receive ........ skipped (Agent Mail not available)
  [--] 6.6 handoff_ack ............ skipped (no thread_id)
  [ok] 6.7 search_sessions ........ 0 results
  [ok] 6.8 search_related ......... 2 results

Phase 7: CLI Commands
  [ok] 7.0 feature-create ......... cli-smoke-test created
  [ok] 7.1 task-next .............. command runs (no tasks yet)
  [ok] 7.2 memory-promote ......... command runs
  [ok] 7.3 handoff-send ........... command runs
  [ok] 7.4 handoff-receive ........ command runs
  [ok] 7.5 handoff-ack ............ command runs
  [ok] 7.6 graph-insights ......... command runs
  [ok] 7.7 graph-next ............. command runs
  [ok] 7.8 graph-plan ............. command runs
  [ok] 7.9 search-sessions ........ command runs
  [ok] 7.10 search-related ........ command runs
  [ok] 7.11 cleanup ............... cli-smoke-test removed

SUMMARY: 47 passed, 1 failed, 5 skipped (of 53 steps)
```

Use `[ok]` for pass, `[!!]` for fail, `[--]` for skipped. Include a brief detail after each marker.

## Cleanup

After reporting, ask the user: "Want me to clean up the smoke test feature directory?" If yes, remove `.maestro/features/pipeline-smoke-test/` and the promoted global memory file.
