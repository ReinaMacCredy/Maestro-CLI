# Delegation Patterns

Patterns for dispatching workers across different task topologies. Choose the pattern that matches your dependency structure.

---

## Pattern 1: Single Worker

**When:** One task, or multiple tasks that share too much state to parallelize.

```
Orchestrator
    |
    v
  Worker A (task 1, 2, 3 sequentially)
    |
    v
  Review & merge
```

**Use when:**
- Tasks modify the same files
- Task 2 depends on Task 1's output
- Shared mutable state (database, config files, type definitions)
- Total work is small enough for one agent

**Workflow:**
```bash
# Find the next runnable task
maestro_task_next

# Claim it
maestro_task_claim --task 01-the-task

# Worker completes the task
# Mark done
maestro_task_done --task 01-the-task --summary "Completed all three subtasks sequentially"

# Review output, merge
```

**Risk:** Bottleneck. If the worker blocks, everything stops.

**Mitigation:** Break the work into subtasks within the single worker's scope so progress is incremental.

---

## Pattern 2: Parallel Workers (Fan-Out)

**When:** 2+ tasks with zero shared state. The primary dispatch pattern.

```
Orchestrator
    |
    +---> Worker A (task 1)
    +---> Worker B (task 2)
    +---> Worker C (task 3)
    |
    v
  Review all, merge all
```

**Use when:**
- Different test files / different modules / different subsystems
- No worker needs another worker's output
- Workers will not edit the same files

**Workflow:**
```bash
# Find runnable tasks
maestro_task_next  # Returns recommended task with compiled spec

# Claim all independent tasks
maestro_task_claim --task 01-fix-auth
maestro_task_claim --task 02-fix-parser
maestro_task_claim --task 03-fix-renderer

# Dispatch workers (pre-agent hook injects task spec automatically)
# Wait for all to complete

# Mark each done and merge incrementally
maestro_task_done --task 01-fix-auth --summary "..."
maestro merge --task 01-fix-auth
bun test

maestro_task_done --task 02-fix-parser --summary "..."
maestro merge --task 02-fix-parser
bun test
```

**Post-dispatch checklist:**
1. Wait for all workers to finish
2. Review each worker's summary
3. Check for file conflicts (did two workers edit the same file?)
4. Run full test suite before merging
5. Merge one at a time, re-testing after each merge

**Risk:** Merge conflicts if independence was misjudged.

**Mitigation:** Before dispatching, verify workers will not touch overlapping files. If unsure, dispatch sequentially.

---

## Pattern 3: Dependent Task Chain (Pipeline)

**When:** Tasks have sequential dependencies -- Task 2 needs Task 1's output.

```
Orchestrator
    |
    v
  Worker A (task 1: define types)
    |
    v
  Review & merge
    |
    v
  Worker B (task 2: implement using types)
    |
    v
  Review & merge
    |
    v
  Worker C (task 3: write integration tests)
    |
    v
  Review & merge
```

**Use when:**
- Task 2 imports from Task 1's output
- Types/interfaces must exist before implementation
- Integration tests need implementation to exist

**Workflow:**
```bash
# Phase 1
maestro_task_next                    # Returns task 01 as runnable
maestro_task_claim --task 01-define-types
# Worker completes
maestro_task_done --task 01-define-types --summary "..."
# Review, merge

# Phase 2 (now runnable because 01 is done)
maestro_task_next                    # Returns task 02 as runnable
maestro_task_claim --task 02-implement
# Worker completes
maestro_task_done --task 02-implement --summary "..."
# Review, merge

# Phase 3
maestro_task_next                    # Returns task 03 as runnable
maestro_task_claim --task 03-integration-tests
# Worker completes
maestro_task_done --task 03-integration-tests --summary "..."
# Review, merge
```

**Optimization -- Hybrid pipeline:** If tasks 2a and 2b both depend on task 1 but not on each other, fan out after task 1:

```
Task 1 (types)
    |
    +---> Task 2a (implementation A)
    +---> Task 2b (implementation B)
    |
    v
Task 3 (integration tests, depends on 2a and 2b)
```

```bash
# Phase 1
maestro_task_claim --task 01-types
# Complete and merge

# Phase 2 (parallel -- both runnable after 01 is done)
maestro_task_claim --task 02a-impl-a
maestro_task_claim --task 02b-impl-b
# Complete both, merge incrementally

# Phase 3
maestro_task_claim --task 03-integration
# Complete and merge
```

**Risk:** Slow -- sequential by nature.

**Mitigation:** Maximize what can run in parallel at each phase. Use `maestro_task_next` to identify all runnable tasks after each merge.

---

## Pattern 4: Blocked Task Recovery

**When:** A worker hits a blocker it cannot resolve (needs a design decision, missing dependency, ambiguous spec).

```
Orchestrator
    |
    v
  Worker A (task 1)
    |
    v
  BLOCKED: "Should we use REST or GraphQL?"
    |
    v
  Orchestrator gets user decision
    |
    v
  Worker A' (resumes task 1 with decision)
    |
    v
  Review & merge
```

**Detection:** `maestro_status` shows the task as `blocked` with a reason.

**Recovery workflow:**
```bash
# 1. The worker called maestro_task_block with a reason.
#    The task is now in `blocked` state.

# 2. Read the blocker details
maestro task-report-read --task 01-the-task

# 3. Present to user, get decision
# "Worker is blocked: [blocker reason]. What should we do?"

# 4. Unblock with the decision -- task returns to `pending`
maestro_task_unblock --task 01-the-task --decision "Use REST -- we need browser compatibility"

# 5. The unblocked task is now pending again.
#    Claim it and dispatch a new worker (or the same worker resumes).
maestro_task_claim --task 01-the-task
```

**What NOT to do:**
- Do NOT guess the answer and resume without asking the user
- Do NOT discard the task and start fresh (partial work is preserved)
- Do NOT start other dependent tasks while this one is blocked

**Parallel blocked recovery:** If multiple workers block on independent questions, collect all questions, present them to the user at once, then unblock all workers.

---

## Pattern 5: Stale Claim Recovery

**When:** A worker's claim has expired -- the worker crashed, timed out, or disconnected.

```
Orchestrator
    |
    v
  Worker A (task 1) --> STALE (claim expired)
    |
    v
  Diagnose: what went wrong?
    |
    v
  maestro_task_next (auto-resets expired claim to pending)
    |
    v
  Worker A' (fresh claim, retry with better context)
    |
    v
  Review & merge
```

**Detection:** `maestro_status` shows the task as `claimed` with an expired timestamp.

**Recovery:**
```bash
# 1. maestro_task_next automatically resets expired claims to pending
maestro_task_next

# 2. Read any partial report the worker left
maestro task-report-read --task 01-the-task

# 3. Diagnose and improve before retrying
```

**Retry strategies:**

| Root Cause | Recovery |
|-----------|----------|
| Spec unclear | Update spec with `maestro task-spec-write`, then re-claim |
| Task too broad | Split into smaller subtasks |
| Worker misunderstood | Add explicit constraints and examples to spec |
| External failure (build broken) | Fix the environment, then re-claim |

```bash
# For tasks needing spec update before retry
maestro task-spec-write --task 01-the-task --content "..."
maestro_task_claim --task 01-the-task
```

---

## Choosing the Right Pattern

```
Is there only 1 task?
  YES --> Pattern 1 (Single Worker)
  NO  --> Do tasks share state or files?
            YES --> Can you sequence them?
                      YES --> Pattern 3 (Pipeline)
                      NO  --> Pattern 1 (Single Worker -- too coupled to split)
            NO  --> Pattern 2 (Parallel Workers)

Did a worker block?       --> Pattern 4 (Blocked Recovery)
Did a worker's claim expire? --> Pattern 5 (Stale Claim Recovery)
```

## Independence Checklist

Before choosing Pattern 2 (Parallel), verify ALL of these:

- [ ] Workers will not edit the same files
- [ ] Workers will not import from each other's new code
- [ ] Workers will not modify shared type definitions
- [ ] Workers will not depend on the same mutable state (DB, config)
- [ ] Each worker's tests can run independently
- [ ] Merging in any order produces the same result

One "no" means you need Pattern 1 or Pattern 3 instead.
