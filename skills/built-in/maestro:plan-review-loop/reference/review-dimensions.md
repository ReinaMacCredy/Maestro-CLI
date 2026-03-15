# Review Dimensions -- Deep Guidance

Each dimension tells the reviewer what to look for. Read this when you need more detail than the summary in SKILL.md.

---

## 1. Completeness

The plan should address everything the spec or user request asks for. Nothing should be silently dropped.

**What to check:**
- Every functional requirement has at least one task
- Error handling is specified (not just happy path)
- Edge cases are mentioned (empty inputs, max limits, concurrent access)
- Migration path is covered if changing existing behavior
- Rollback strategy exists for risky changes

**Common misses:**
- "Update the API" without specifying backward compatibility
- No task for updating tests after behavior change
- Missing documentation/changelog tasks
- No consideration of existing data migration

**Red flag:** A plan that only describes what to build, never what could go wrong.

---

## 2. Feasibility

Can this actually be built as described? Are there hidden blockers?

**What to check:**
- Dependencies on external APIs/services are realistic (rate limits, auth, availability)
- Time/complexity estimates match the actual work (if estimates are given)
- The tech stack can support the proposed approach
- Required permissions/access are available
- No assumptions about features that don't exist yet

**Common misses:**
- "Use the existing caching layer" when no caching layer exists
- Assuming a library API works a certain way without checking
- Planning parallel work on files that will have merge conflicts

**Red flag:** A plan that sounds elegant but skips the messy parts.

---

## 3. Dependencies

Tasks should be ordered correctly. Nothing should start before its prerequisites are done.

**What to check:**
- Task dependency graph has no cycles
- Shared infrastructure tasks come before tasks that use them
- Database migrations before code that uses new schemas
- API changes before consumers of those APIs
- Test infrastructure before tests

**Common misses:**
- Two tasks that modify the same file listed as parallelizable
- "Add feature flag" listed after "deploy feature"
- No dependency between "create interface" and "implement interface"

**Red flag:** All tasks listed as independent when they clearly aren't.

---

## 4. Risk

What could go wrong, and does the plan account for it?

**What to check:**
- Fragile assumptions are identified (if X changes, this breaks)
- High-risk tasks have verification steps
- External dependency failures have fallback plans
- Data loss scenarios are considered
- Security implications are addressed

**Common misses:**
- No mention of what happens if the migration fails halfway
- Assuming network calls always succeed
- No rollback plan for database schema changes
- Ignoring rate limits on third-party APIs

**Red flag:** Zero risk items in a multi-phase plan.

---

## 5. Testing

Is the testing strategy adequate for the changes being made?

**What to check:**
- Critical paths have explicit test tasks
- Test types match the changes (unit for logic, integration for boundaries, e2e for flows)
- Edge cases from the completeness check have corresponding tests
- Regression tests for existing functionality that might break
- Test data/fixtures are accounted for

**Common misses:**
- "Add tests" as a single task covering everything (too vague)
- No integration tests for new API endpoints
- No tests for error handling paths
- Testing strategy that only covers happy path

**Red flag:** Testing is a single bullet point at the end, not woven into each phase.

---

## 6. Scope

Is the plan doing too much or too little?

**What to check:**
- Every task is traceable to a requirement (no gold-plating)
- No "while we're at it" refactoring mixed in with feature work
- Complexity is proportional to the problem (simple problems get simple solutions)
- No premature abstractions or unnecessary configurability
- Non-goals are explicit

**Common misses:**
- Adding a plugin system when a single implementation is needed
- Refactoring adjacent code that isn't broken
- Building admin UI for a feature that 3 people will use
- Over-engineering error handling for impossible scenarios

**Red flag:** The plan is 3x longer than the problem description.

---

## 7. Ordering

Is the sequence logical? Could things be done more efficiently?

**What to check:**
- High-risk/unknown items are tackled early (fail fast)
- Foundation tasks before feature tasks
- Independent tasks identified for parallel execution
- No phase has too many tasks (3-5 per phase is ideal)
- Verification gates between phases

**Common misses:**
- UI work in phase 1, backend in phase 2 (should be opposite)
- All tasks in one giant phase with no checkpoints
- Easy wins buried in late phases (front-load quick confidence builders)

**Red flag:** 15 tasks in a single phase with no verification step.

---

## 8. Clarity

Could a worker agent execute each task without asking clarifying questions?

**What to check:**
- Each task has clear acceptance criteria
- File paths and module names are specific (not "update the relevant files")
- API contracts are defined (request/response shapes)
- Behavior is specified, not just structure ("button submits form and shows success toast", not "add button")
- Ambiguous terms are defined

**Common misses:**
- "Implement the feature" as a task description
- "Handle errors appropriately" without specifying how
- "Update config" without specifying which fields and values
- Tasks that say "if needed" (decide now, not during execution)

**Red flag:** More than 2 tasks that start with "Implement" and nothing else.
