# Parallel Mode Protocol

## Overview

Parallel mode uses Task sub-agents to execute independent tasks concurrently. You (the main session) analyze the task graph for parallelism opportunities, spawn sub-agents in isolated worktrees, then verify and merge their results before committing. Sub-agents can read, write, and edit files but cannot commit, touch BR state, or modify maestro state.

## When to Use

- 3-8 tasks with 2+ independent tasks
- Tasks modify different files (low file scope overlap)
- Tasks do not depend on each other's output within the same wave
- Runtime supports the Task tool with worktree isolation

**Do not use** when all tasks are sequential, tasks heavily overlap in file scope, or the feature has fewer than 3 tasks (overhead exceeds benefit).

## Prerequisites

Your runtime must support the Task tool for spawning sub-agents.
- Claude Code: Task tool with `isolation: "worktree"` parameter
- Other runtimes: use your native sub-agent/delegation mechanism with filesystem isolation

### Agent Mail (Optional)

If the `mcp-agent-mail` MCP server is available, parallel mode uses it for **advisory file reservations** to detect scope conflicts before spawning sub-agents. This replaces heuristic file-scope inference with explicit lock checks.

Setup (once per session, before first wave):
1. `ensure_project` with `human_key` set to the project's absolute path
2. `register_agent` for the main session (auto-generated name is fine)

If agent-mail is not available, parallel mode falls back to heuristic file-scope analysis (the default behavior described below).

---

## Step 6b: Analyze Tasks for Parallelism

### 6b.1: Build Task Dependency Graph

Call `maestro_task_next` repeatedly (or `maestro_task_list` for a full view) to understand the task graph. For each pending task, determine:

1. **Explicit dependencies**: Tasks blocked by earlier tasks (defined in `maestro_tasks_sync` output)
2. **File scope**: Infer which files each task will modify based on the task spec
3. **Independence**: Two tasks are independent if:
   - Neither depends on the other's output
   - Their likely file scopes do not overlap
   - They have no dependency relationship in the task graph

4. **File reservation check** (if agent-mail available): After heuristic analysis, call `file_reservation_paths` with `exclusive: true` for each task's inferred file scope. If `conflicts` are returned (another task already reserved overlapping paths), move the conflicting task to a later wave. This replaces guesswork with concrete overlap detection.

### 6b.2: Classify Tasks into Waves

Partition pending tasks into waves:

**Wave 1**: All tasks with no unmet dependencies
**Wave 2**: Tasks whose dependencies are all in Wave 1
**Wave N**: Tasks whose dependencies are all in earlier waves

Tasks within the same wave are independent and can run in parallel.

Report the parallelism plan to the user before executing:

```
[ok] Parallelism analysis:
  Wave 1 (parallel): Task {A}, Task {B}
  Wave 2 (sequential): Task {C} (depends on {A})
  --> {M} tasks parallel, {K} sequential
```

### 6b.3: Fallback to Sequential

If ALL tasks are dependent (no parallelism possible), print:

```
[!] No independent tasks found. Falling back to single-agent mode.
```

Execute using the single-agent protocol from `reference/single-agent-execution.md`.

---

## Step 6c: Wave Execution Loop

For each wave:

### 6c.1: Claim Tasks, Reserve Files, and Spawn Sub-agents

For each task in the wave, call `maestro_task_claim` to transition it from `pending` to `claimed`.

**File reservations** (if agent-mail available): Before spawning, call `file_reservation_paths` for each task's inferred file scope with `exclusive: true` and a TTL of 7200 seconds. If any reservation returns `conflicts`, re-sequence the conflicting task into a later wave.

```
file_reservation_paths parameters:
  project_key: {project_absolute_path}
  agent_name: {registered_agent_name}
  paths: ["src/api/*.py", "tests/test_api.py"]  (task's inferred file scope)
  ttl_seconds: 7200
  exclusive: true
  reason: "Task {slug}: {task_title}"
```

For each claimed task in the wave (after reservations clear), spawn a Task sub-agent with worktree isolation:

```
Task tool parameters:
  subagent_type: "general-purpose"
  isolation: "worktree"
  mode: "bypassPermissions"
  prompt: <sub-agent prompt template below>
  description: "Task {slug}: {task_title}"
  run_in_background: true  (for all but the last task in the wave)
```

Spawn ALL sub-agents in a single message (parallel tool calls) for maximum concurrency.

**Rate limit handling**: If Task tool returns a rate limit error, queue the remaining tasks and execute them sequentially after the current parallel batch completes.

### 6c.2: Sub-agent Prompt Template

Each sub-agent receives the compiled task spec from `maestro_task_next`:

```
You are executing a single task from a maestro implementation plan.

## Your Task
{task_slug}: {task_title}

### Spec
{compiled task spec from maestro_task_next}

## Context
- Feature plan: Read `.maestro/features/<feature-name>/plan.md`
- Memory: Read relevant entries from `.maestro/memory/` and `.maestro/features/<feature-name>/memory/`

## Instructions
Follow the {TDD/ship-fast} methodology:
{methodology steps}

## Constraints
- You MUST NOT run git commit, git add, or any git write operations
- You MUST NOT modify .maestro/ files
- You MUST NOT run br/bv commands
- You MUST NOT call maestro MCP tools (task state is managed by the main session)
- You MUST NOT call agent-mail MCP tools (file reservations are managed by the main session)
- You CAN read any file, write new files, edit existing files, and run tests
- You CAN install dependencies if needed (but prefer existing stack)
- After completing all work, report what you changed and test results

## Deliverable
When done, provide:
1. List of files created/modified
2. Test results (command run + output)
3. Any issues encountered
```

### 6c.3: Wait for Completion

Wait for all sub-agents in the wave to complete. The system will notify when each finishes.

**Timeout handling**: If a sub-agent does not complete within a reasonable time (no fixed limit -- watch for the system notification), check its status. If stuck, note it for sequential retry.

### 6c.4: Collect Results

For each completed sub-agent:

1. Read the sub-agent's result message
2. Note the worktree path and branch returned
3. Record which files were changed and test outcomes

---

## Step 6d: Verify and Merge

### 6d.1: Verify Each Sub-agent's Work

For each completed sub-agent, in the main worktree:

1. **Cherry-pick or merge the worktree branch**:
   ```bash
   git merge --no-commit {worktree_branch}
   ```
   Or selectively apply changes if conflicts exist.

2. **Re-read changed files** to confirm correctness
3. **Re-run the test suite**:
   ```bash
   CI=true {test_command}
   ```
4. If tests pass: proceed to commit
5. If tests fail: reject this sub-agent's work and queue the task for sequential retry

### 6d.2: Conflict Detection

If multiple sub-agents in a wave modified the same file:

1. **Non-overlapping hunks**: Auto-merge via git's merge strategy
2. **Overlapping hunks**: Stop and present the conflict to the user:
   ```
   [!] File conflict in {file_path}:
     Task {A} modified lines {X-Y}
     Task {B} modified lines {X-Z}
   --> Resolve manually or retry tasks sequentially?
   ```
3. If user chooses sequential retry: queue both tasks for sequential execution, discard worktree results

### 6d.3: Commit Wave Results

After all sub-agents in the wave are verified:

```bash
git add {all_changed_files}
git commit -m "{type}({scope}): {description} [parallel: tasks {list}]"
```

One commit per wave. Include `[parallel: tasks {slug1}, {slug2}]` suffix to indicate which tasks were parallelized.

### 6d.4: Update Task State

For each successfully completed task in the wave:

1. Call `maestro_task_done` with the task ID and a summary including the commit SHA
2. **BR mirror**: If `feature.json` has `beads_epic_id`, close the corresponding BR issues:
   ```bash
   br close {issue_id} --reason "sha:{sha7} | parallel wave" --suggest-next --json
   ```

### 6d.5: Clean Up Worktrees and Reservations

After successful merge and commit, worktrees from completed sub-agents are automatically cleaned up by the Task tool. Verify cleanup:

```bash
git worktree list
```

Remove any stale worktrees:
```bash
git worktree prune
```

**Release file reservations** (if agent-mail was used): Call `release_file_reservations` for the main agent to free all reserved paths for the completed wave. This allows the next wave's tasks to reserve the same files if needed.

```
release_file_reservations parameters:
  project_key: {project_absolute_path}
  agent_name: {registered_agent_name}
```

---

## Step 6e: Handle Failures

### Sub-agent Failure

If a sub-agent fails (returns error or produces broken code):

1. Log the failure:
   ```
   [!] Sub-agent for Task {slug} failed: {error summary}
   --> Retrying sequentially in main session
   ```
2. Queue the task for sequential execution using the single-agent protocol
3. Continue processing successful sub-agents from the same wave

### Mixed Results

If some sub-agents in a wave succeed and others fail:

1. Verify and merge successful results first
2. Commit successful work
3. Retry failed tasks sequentially
4. This ensures progress is not lost due to individual failures

### Merge Failure After Verification

If tests pass in the worktree but fail after merging into main:

1. The conflict is between the merged code and main branch state
2. Identify which task's changes cause the failure
3. Revert the merge: `git merge --abort` or `git reset --hard HEAD`
4. Re-execute the failing task sequentially with full main branch context
5. The sub-agent lacked visibility into other wave results -- sequential execution fixes this

### Orphaned Worktrees

On `--resume` with `--parallel`, check for stale worktrees from a previous interrupted run:

```bash
git worktree list --porcelain | grep -A1 "worktree.*\.claude/worktrees"
```

If found, prune them:
```bash
git worktree prune
```

---

## Worked Example: Parallel Execution

**Feature**: "Add REST API endpoints for user management"
**Tasks** (from `maestro_task_next` / `maestro_task_list`):
- 01-get-users: Create GET /users endpoint
- 02-get-user-by-id: Create GET /users/:id endpoint
- 03-post-users: Create POST /users endpoint
- 04-validation-middleware: Add input validation middleware
- 05-pagination: Add pagination to GET /users

**Dependency analysis:**

```
01-get-users: Modifies src/routes/users.ts, tests/users.test.ts     | no deps
02-get-user-by-id: Modifies src/routes/users.ts, tests/users.test.ts     | no deps
03-post-users: Modifies src/routes/users.ts, tests/users.test.ts     | no deps
04-validation-middleware: Modifies src/middleware/validation.ts                  | no deps
05-pagination: Modifies src/routes/users.ts (depends on 01 output)  | depends on 01

[!] Tasks 01, 02, 03 all modify src/routes/users.ts
--> File scope overlap detected. Cannot parallelize all three.
```

**Wave assignment:**

```
[ok] Parallelism analysis:
  Wave 1 (parallel): 01-get-users, 04-validation-middleware
    - 01: src/routes/users.ts (GET /users only)
    - 04: src/middleware/validation.ts (no overlap)
  Wave 2 (parallel): 02-get-user-by-id, 03-post-users
    - Both touch users.ts but in different handler functions
    - Acceptable risk -- hunks unlikely to overlap
  Wave 3 (sequential): 05-pagination
    - Depends on 01 (needs the GET /users handler to add pagination)
  --> 4 tasks parallel across 2 waves, 1 sequential
```

**Execution:**

```
--- Wave 1 ---
maestro_task_claim("01-get-users")
maestro_task_claim("04-validation-middleware")
Spawning sub-agent: 01-get-users [worktree: .claude/worktrees/01-get-users]
Spawning sub-agent: 04-validation-middleware [worktree: .claude/worktrees/04-validation-middleware]

[ok] 04-validation-middleware complete: src/middleware/validation.ts created, 6 tests pass
[ok] 01-get-users complete: GET /users handler added, 4 tests pass

Merging wave 1...
  git merge --no-commit worktree/01-get-users  [ok]
  git merge --no-commit worktree/04-validation-middleware  [ok]
  CI=true bun test  [ok] 10 new tests pass, 0 regressions
  git commit -m "feat(api): add GET /users and validation middleware [parallel: 01-get-users, 04-validation-middleware]"
maestro_task_done("01-get-users", summary: "GET /users handler (sha: m1n2o3p)")
maestro_task_done("04-validation-middleware", summary: "Validation middleware (sha: m1n2o3p)")

--- Wave 2 ---
maestro_task_claim("02-get-user-by-id")
maestro_task_claim("03-post-users")
Spawning sub-agent: 02-get-user-by-id
Spawning sub-agent: 03-post-users

[ok] 02-get-user-by-id complete: 3 tests pass
[!] 03-post-users failed: "Cannot find module '../models/user'"
--> Sub-agent needed a model that doesn't exist yet.
--> Queuing 03-post-users for sequential retry.

Merging wave 2 (partial)...
  git merge --no-commit worktree/02-get-user-by-id  [ok]
  CI=true bun test  [ok]
  git commit -m "feat(api): add GET /users/:id [parallel: 02-get-user-by-id]"
maestro_task_done("02-get-user-by-id", summary: "GET /users/:id handler (sha: q4r5s6t)")

--- Task 03-post-users (sequential retry) ---
Executing in main session with full context...
Created src/models/user.ts (was missing from task scope)
Created POST /users handler
[ok] 5 tests pass
maestro_task_done("03-post-users", summary: "POST /users handler + user model (sha: u7v8w9x)")

--- Wave 3 ---
maestro_task_claim("05-pagination")
05-pagination: Adding pagination to GET /users (sequential, depends on 01)
[ok] 3 tests pass
maestro_task_done("05-pagination", summary: "Pagination for GET /users (sha: y0z1a2b)")

--- All tasks done ---
```

---

## Phase Completion

After all tasks are done (all tasks verified and committed), run the standard Phase Completion Protocol from `reference/phase-completion.md`.

The phase completion check runs against the main worktree, which now contains all merged results from parallel sub-agents.

---

## Anti-patterns

| Don't | Do Instead |
|-------|-----------|
| Let sub-agents commit | Main session commits after verification |
| Skip verification of sub-agent output | Always re-read files and re-run tests |
| Spawn sub-agents for dependent tasks | Only parallelize independent tasks |
| Ignore file scope overlap | Check for potential conflicts before spawning |
| Force all tasks parallel | Fall back to sequential when parallelism adds no value |
| Spawn too many sub-agents (>4) | Limit wave size to 3-4 concurrent sub-agents |
| Skip file reservations when agent-mail is available | Reserve paths before spawning to catch conflicts early |
| Retry failed sub-agents in parallel again | Sequential retry gives full context and avoids repeating the same failure |
| Ignore partial wave failures | Merge successful work, retry failures sequentially |
