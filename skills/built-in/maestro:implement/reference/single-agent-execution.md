# Single-Agent Execution Protocol

## When to Use

Single-agent mode is the default. Use it when:
- Feature has 1-3 tasks
- All tasks are sequential (each depends on the previous)
- Tasks touch heavily overlapping files
- You want maximum control and review between each task

## Task Execution Loop

For each task, use the maestro task lifecycle: claim, execute, done.

**Loop structure:**
```
for each task from maestro_task_next:
  6a.1: Claim the task
  6a.2-6a.4: Red-Green-Refactor (TDD) or Implement-Test (ship-fast)
  6a.5-6a.6: Verify coverage and compliance
  6a.7-6a.9: Commit, attach summary, mark done
end
Phase Completion Protocol (after last task in a phase)
```

---

## TDD Methodology

### 6a.1: Claim the Task

Call `maestro_task_claim` (MCP) or `maestro task-claim` (CLI) with the task ID returned by `maestro_task_next`. This transitions the task from `pending` to `claimed`.

**Deferred context**: If deferred context (memory entries, tech-stack notes) has not been loaded yet, load it now before executing the first task.

If `br_enabled`: see BR Mirror Protocol below.

### 6a.2: Red Phase -- Write Failing Tests

1. Identify what to test based on the task spec (compiled by `maestro_task_next`)
2. Create test file if it doesn't exist
3. Write tests defining expected behavior
4. Run test suite:
   ```bash
   CI=true {test_command}
   ```
5. Confirm tests FAIL (this validates they're meaningful)
6. If tests pass unexpectedly: the behavior already exists. Skip to refactor or mark complete.
7. Do NOT proceed to implementation until tests fail.

### 6a.3: Green Phase -- Implement to Pass

1. Write minimum code to make tests pass
2. Run test suite:
   ```bash
   CI=true {test_command}
   ```
3. Confirm tests PASS
4. If tests fail: debug and fix. Max 3 attempts. If still failing, ask user for help.

### 6a.4: Refactor (Optional)

1. Review the implementation for code smells
2. Improve readability and structure
3. Run tests again to confirm still passing
4. Skip if implementation is already clean

### 6a.5: Verify Coverage

If the project specifies a coverage threshold:
```bash
CI=true {coverage_command}
```

Check that new code meets the threshold. If not, add more tests.

### 6a.6: Check Tech Stack Compliance

If the task introduced a new library or technology not established in the project:
1. STOP implementation
2. Inform user: "This task uses {new_tech} which isn't in the tech stack."
3. Ask: Add to tech stack or find an alternative?
4. If approved: record the decision via `maestro_memory_write`
5. Resume

### 6a.7: Commit Code Changes

```bash
git add {changed_files}
git commit -m "{type}({scope}): {description}"
```

Commit message format:
- `feat(scope):` for new features
- `fix(scope):` for bug fixes
- `refactor(scope):` for refactoring
- `test(scope):` for test-only changes

### 6a.8: Attach Summary (if configured)

If git notes are configured:
```bash
git notes add -m "Task: {task_name}
Phase: {phase_number}
Changes: {files_changed}
Summary: {what_and_why}" {commit_hash}
```

If commit messages: include summary in the commit message body.

### 6a.8.5: Capture Task Notes

If the task produced a non-obvious decision, constraint, or learning during implementation:

1. Write it to memory via `maestro_memory_write` (MCP) or `maestro memory-write` (CLI)
2. Format: `[{date}] [{feature-name}:{task_name}] {insight}`
3. Only capture durable insights -- not routine status. Skip if nothing notable.

### 6a.9: Mark Task Done

Call `maestro_task_done` (MCP) or `maestro task-done` (CLI) with the task ID and a summary of changes. This transitions the task from `claimed` to `done`.

Include the commit SHA in the summary for traceability.

If `br_enabled`: see BR Mirror Protocol below.

After marking done, call `maestro_task_next` to get the next runnable task.

---

## Ship-fast Methodology

Same flow but reordered:
1. Claim the task (`maestro_task_claim`)
2. Implement the feature/fix
3. Write tests covering the implementation
4. Run tests, verify passing
5. Commit, attach summary, mark done (`maestro_task_done`)

---

## Worked Example: Single-Agent TDD

**Feature**: "Add user email validation"
**Tasks** (from `maestro_task_next`):
- Task 01-create-email-validator: Create email validator module
- Task 02-integrate-validator: Integrate validator into registration form
- Task 03-add-error-messages: Add error messages for invalid emails

**Execution flow:**

```
[ok] Starting Feature: add-user-email-validation (single-agent mode)
[ok] Called maestro_task_next -- returned task 01-create-email-validator

--- Task 01: Create email validator module ---
[ok] maestro_task_claim("01-create-email-validator") -- claimed
RED:   Created tests/email-validator.test.ts
       - rejects empty string
       - rejects missing @
       - accepts valid email
       Run: CI=true bun test tests/email-validator.test.ts
       [ok] 3 tests FAIL (expected -- module doesn't exist)

GREEN: Created src/utils/email-validator.ts
       Run: CI=true bun test tests/email-validator.test.ts
       [ok] 3 tests PASS

REFACTOR: Extracted regex to named constant. Tests still pass.

COMMIT: git add src/utils/email-validator.ts tests/email-validator.test.ts
        git commit -m "feat(validation): add email validator module"
[ok] maestro_task_done("01-create-email-validator", summary: "Added email validator (sha: a1b2c3d)")

--- maestro_task_next --> task 02-integrate-validator ---

--- Task 02: Integrate validator into registration form ---
[ok] maestro_task_claim("02-integrate-validator") -- claimed
RED:   Added test in tests/registration.test.ts
       - form rejects invalid email on submit
       Run: CI=true bun test tests/registration.test.ts
       [ok] 1 test FAILS (validator not wired up)

GREEN: Imported validator in src/routes/register.ts
       Run: CI=true bun test tests/registration.test.ts
       [ok] All tests PASS

COMMIT: git commit -m "feat(registration): integrate email validation"
[ok] maestro_task_done("02-integrate-validator", summary: "Integrated validation (sha: d4e5f6g)")

--- maestro_task_next --> task 03-add-error-messages ---

--- Task 03: Add error messages for invalid emails ---
[ok] maestro_task_claim("03-add-error-messages") -- claimed
RED:   Added tests for error message rendering
       [ok] Tests FAIL (no error UI exists)

GREEN: Added error display component
       [ok] Tests PASS

COMMIT: git commit -m "feat(registration): add validation error messages"
[ok] maestro_task_done("03-add-error-messages", summary: "Added error messages (sha: h7i8j9k)")

--- maestro_task_next --> no more tasks ---

--- Phase Completion ---
[ok] Full test suite: 47 tests, all passing
[ok] Coverage: 94% (threshold: 80%)
Presenting manual verification plan to user...
```

---

## Failure Recovery (Single-Agent)

### Test Won't Pass After 3 Attempts

```
[!] Task 02-integrate-validator test "form rejects invalid email" fails after 3 fix attempts.
    Error: TypeError: validator.validate is not a function
--> STOPPING. Asking user for help.
```

Possible causes:
- Spec is ambiguous about the expected API
- Task 01 produced a different interface than Task 02 expects
- Missing dependency or import issue

Recovery: Ask user to clarify, then fix and continue. Do NOT skip the task.

### Build Breaks on Later Task

If Task 03 breaks code from Task 01:

1. Run the full test suite to identify all failures
2. Determine if the break is in Task 03's changes or a latent issue
3. If Task 03 caused it: fix within Task 03 before committing
4. If latent issue: create a fix sub-task, execute it, then continue

### Unexpected Behavior Already Exists

If the Red phase shows tests already passing:

```
[!] Task 01 tests pass immediately -- email validator already exists.
--> Behavior already implemented. Checking if it matches spec...
```

1. Read the existing implementation
2. Compare against the spec
3. If matches: mark task done with a note, skip implementation
4. If differs: write tests for the MISSING behavior, then implement

---

## BR Mirror Protocol

Only applies when `br_enabled` (set in Step 4.5 of SKILL.md).

### On task claim (6a.1)

Claim the corresponding BR issue:

```bash
br update {issue_id} --claim --json
```

Look up `{issue_id}` from `feature.json` `beads_issue_map` using the task key (e.g., `P1T1`).

### On task done (6a.9)

Close the corresponding BR issue:

```bash
br close {issue_id} --reason "sha:{sha7} | tests pass | {evidence}" --suggest-next --json
```

Look up `{issue_id}` from `feature.json` `beads_issue_map`. The `--suggest-next` flag returns newly unblocked issues.
