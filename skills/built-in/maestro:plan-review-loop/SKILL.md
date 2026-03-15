---
name: maestro:plan-review-loop
description: "Deep-review any plan (maestro, Codex, Claude Code plan mode, or plain markdown) using iterative subagent review loops. Spawns reviewer subagents that find issues, fixes them, re-reviews until the plan passes with zero actionable issues. Use when the user says 'review the plan', 'deep review', 'check the plan thoroughly', 'review loop', 'validate before approving', or wants rigorous plan validation before execution. Also use proactively before plan-approve when the plan is complex or high-risk."
---

# Plan Review Loop

## Overview

Iteratively review and improve a plan by delegating review to subagents, fixing issues they find, and re-reviewing until the plan is clean. No iteration limit -- loop until the plan passes.

The point of using subagents for review (rather than reviewing inline) is independence. A fresh subagent has no sunk-cost bias from having written the plan. It reads the plan cold and judges it on merit. This catches blind spots that the plan author (you or a prior agent) would miss.

## When to Use

- Before `maestro plan-approve` on any non-trivial plan
- Before executing a Codex plan or Claude Code plan-mode plan
- When the user explicitly asks for deep review
- When you wrote the plan yourself and want honest validation before proceeding
- When the plan is complex (3+ phases, 5+ tasks, cross-cutting concerns)

## When NOT to Use

- Simple, single-task plans (one file change, obvious fix)
- The user explicitly says they don't want review
- The plan has already been through this loop and approved

## The Loop

```
     +------------------+
     |  1. Read Plan    |
     +--------+---------+
              |
     +--------v---------+
     |  2. Spawn        |
     |     Reviewer      |
     +--------+---------+
              |
     +--------v---------+
     |  3. Issues        |
     |     Found?        |
     +---+----------+---+
         |          |
        YES         NO
         |          |
+--------v---+  +---v-----------+
| 4. Fix     |  | 5. Plan is    |
|    Issues  |  |    OKAY       |
+--------+---+  +---------------+
         |
         | (back to step 2)
         +---------->
```

### Step 1: Read the Plan

Detect the plan source and read it:

| Source | How to detect | How to read |
|--------|--------------|-------------|
| Maestro feature | User says "review the plan for [feature]" | `maestro plan-read --feature <name>` |
| File path | User provides a path (`.md`, `.txt`) | Read the file directly |
| Plan mode | Active plan in `~/.claude/plans/` | Read the plan file |
| Inline | Plan is in the conversation | Extract from conversation context |
| Codex | Plan in `.codex/` or similar | Read the file directly |

If the source is ambiguous, ask: "Where is the plan? Give me a feature name, file path, or paste it."

### Step 2: Spawn Reviewer Subagent

Launch a subagent with the plan content and review criteria. The reviewer is a fresh agent with no context from prior work -- this is the point.

```
Agent({
  prompt: `You are a plan reviewer. Read and deeply review the following plan.

PLAN:
<plan>
{plan content here}
</plan>

CONTEXT (if available):
- Project: {project description}
- Tech stack: {languages, frameworks}
- Constraints: {any known constraints}

Review the plan against ALL of these dimensions:
1. COMPLETENESS -- Are all requirements addressed? Missing edge cases? Missing error handling?
2. FEASIBILITY -- Can this actually be built as described? Are estimates realistic?
3. DEPENDENCIES -- Are task dependencies correct? Any circular deps? Missing prerequisites?
4. RISK -- What could go wrong? Are there fragile assumptions? Missing fallback strategies?
5. TESTING -- Is the testing strategy adequate? Are critical paths covered?
6. SCOPE -- Is it YAGNI-compliant? Over-engineered? Under-specified?
7. ORDERING -- Is the phase/task order logical? Could anything be parallelized?
8. CLARITY -- Could a worker agent execute each task without ambiguity?

For each issue found, report:
- SEVERITY: [blocker] [major] [minor] [nit]
- DIMENSION: which of the 8 above
- LOCATION: which section/task/phase
- ISSUE: what's wrong
- FIX: how to fix it

If you find ZERO actionable issues (blocker/major/minor), respond with exactly:
VERDICT: PASS

If you find ANY actionable issues, respond with exactly:
VERDICT: FAIL
Then list all issues.

Be rigorous. A plan that "seems fine" is not a PASS. Look for what's missing, not just what's wrong.`,
  mode: "bypassPermissions"
})
```

See `reference/review-dimensions.md` for detailed guidance on each review dimension.

### Step 3: Evaluate Review Results

Parse the reviewer's response:

- **VERDICT: PASS** --> The plan is clean. Proceed to Step 5.
- **VERDICT: FAIL** --> Issues found. Proceed to Step 4.

Track the review history:
- Log which iteration you're on
- Log how many issues were found per round
- If issue count is NOT decreasing after 3 rounds, something is wrong -- report to user and ask for guidance

### Step 4: Fix Issues

For each issue the reviewer found:

| Severity | Action |
|----------|--------|
| `[blocker]` | Must fix before continuing. These are fundamental design flaws. |
| `[major]` | Must fix. Missing requirements, incorrect dependencies, scope problems. |
| `[minor]` | Fix if straightforward. Unclear wording, missing detail, small gaps. |
| `[nit]` | Skip unless trivial. Style, formatting, preference. |

**How to fix depends on plan source:**

| Source | Fix method |
|--------|-----------|
| Maestro | `maestro plan-write --feature <name>` with updated content |
| File | Edit the plan file directly |
| Plan mode | Edit the plan file |
| Inline | Rewrite the plan section in conversation |

After fixing, go back to Step 2 with the updated plan.

### Step 5: Plan is OKAY

When the reviewer returns VERDICT: PASS:

1. Report to the user: "Plan passed review after N rounds. Here's what was fixed:"
   - Summarize the issues found and fixed across all rounds
   - Note any nits that were intentionally skipped
2. If this is a maestro plan, suggest: `maestro plan-approve --feature <name>`
3. If this is a file-based plan, confirm the file has been updated

## Convergence Safety

The loop has no hard iteration limit -- that's intentional. But watch for these signals:

**Healthy convergence:** Issue count drops each round (e.g., 5 --> 2 --> 0). This is normal.

**Stalled convergence:** Issue count stays flat or oscillates (e.g., 3 --> 4 --> 3). This means either:
- Fixes are introducing new issues (be more careful with edits)
- The reviewer is being inconsistent (subjective feedback masquerading as issues)
- The plan has a fundamental structural problem that piecemeal fixes can't solve

**What to do when stalled:**
- After 3 rounds with no progress, pause and report to the user
- Show the recurring issues
- Ask: "These issues keep coming back. Want me to restructure the plan, or are these acceptable?"
- If the user says acceptable, mark them as acknowledged and continue

**Divergence (issue count increasing):** Stop immediately. Fixes are making things worse. Report to user with the history.

## Progress Reporting

Keep the user informed during the loop:

- After each review round: "Round N: reviewer found X issues (Y blocker, Z major). Fixing..."
- After each fix round: "Fixed N issues. Sending back for review..."
- On completion: "Plan passed after N rounds. Summary of changes: ..."

## Key Principles

- **Fresh eyes every round** -- Each reviewer subagent starts clean. No accumulated context bias.
- **Fix before re-review** -- Never send the same plan back without changes. That's a waste.
- **Severity discipline** -- Don't let nits block convergence. Fix blockers and majors, skip nits if they're stalling progress.
- **User stays in control** -- Report progress, surface stalls, ask when stuck. The user can stop the loop anytime.
- **No iteration limit** -- But watch convergence. Healthy loops converge in 2-4 rounds.
