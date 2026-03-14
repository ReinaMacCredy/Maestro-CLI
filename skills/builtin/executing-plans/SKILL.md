---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

## Overview

Load the plan, review it critically, execute one runnable task at a time, and report for review between checkpoints.

**Core principle:** Single-checkout execution with checkpoints for architect review.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create TodoWrite and proceed

### Step 2: Identify Runnable Tasks

Use `maestro_status` (or `maestro status`) to get the **runnable** list — tasks with all dependencies satisfied.

Only `done` satisfies dependencies (not `blocked`, `failed`, `partial`, `cancelled`).

**When 2+ tasks are runnable:**
- Ask the operator which runnable task to take next.
- Record the decision with `maestro_context_write` (or `maestro context-write`) if the ordering matters for later work.

**When 1 task is runnable:** Proceed directly.

### Step 3: Execute The Next Task

For the selected task:
1. Start it via `maestro_task_start` (or `maestro task-start`)
2. Follow each step exactly (the plan has bite-sized steps)
3. Let the worker complete with `maestro_task_finish` (or `maestro task-finish`)
4. Re-run `maestro_status` before choosing the next task

### Step 4: Report
When the task checkpoint is complete:
- Show what was implemented
- Show verification output
- Say: "Ready for feedback."

### Step 4.5: Post-Batch Hygienic Review

After the checkpoint report, ask the operator if they want a Hygienic code review for the latest task.
If yes, run `task({ subagent_type: "hygienic", prompt: "Review implementation changes from the latest batch." })` and apply feedback before starting the next batch.

### Step 5: Continue
Based on feedback:
- Apply changes if needed
- Execute the next runnable task
- Repeat until complete

### Step 6: Complete Development

After all tasks complete and verified:
- Announce: "I'm using the verification-before-completion skill to complete this work."
- **REQUIRED SUB-SKILL:** Use hive_skill:verification-before-completion
- Follow that skill to verify tests, present options, execute choice

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker mid-batch (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Between batches: just report and wait
- Stop when blocked, don't guess
