---
name: maestro:status
description: "Interpret feature progress, detect problems, and recommend next actions based on maestro status output."
---

# Status -- Feature Progress & Next Actions

## Overview

Read the current feature state and translate it into actionable guidance. Status is the orientation layer -- run it at session start, after completing work, or when uncertain about what to do next.

**Core principle:** Status is not a passive display. It is a diagnostic. Detect problems, highlight what needs attention, and tell the user exactly what command to run next.

## When to Use

- Session start (always)
- After a task completes or is blocked
- When the user asks "what's next?" or "where are we?"
- Before starting any new work (to check for stale claims, blockers, or drift)

## Step 1: Gather State

Run `maestro_status` (MCP) or `maestro status` (CLI). Use `--feature <name>` for a specific feature.

If no active feature is set:
- Report: "No active feature. Run `maestro feature-active <name>` to set one, or `maestro feature-list` / `maestro_feature_list` to see available features."
- If no features exist at all: "No features found. Run `maestro feature-create <name>` / `maestro_feature_create` to start."
- Stop.

The status output contains these fields:
- **feature**: name and status (`planning` | `approved` | `executing` | `completed`)
- **plan**: exists (yes/no), approved (yes/no), comment count
- **tasks**: total, pending, claimed, done, blocked counts, plus individual task list with statuses
- **stale claims**: claimed tasks whose claim has expired (zombie tasks)
- **memory**: file count and byte total for saved memory
- **nextAction**: the system's recommended next step

## Step 2: Identify the Feature Phase

Map the status output to one of four phases. This determines what to emphasize in the report.

| Feature Status | Plan     | Tasks      | Phase         | Focus                              |
|----------------|----------|------------|---------------|------------------------------------|
| `planning`     | none     | 0          | Discovery     | Gathering requirements, exploring  |
| `planning`     | draft    | 0          | Planning      | Refining plan, addressing comments |
| `approved`     | approved | 0          | Pre-Execution | Need to sync tasks from plan       |
| `approved`     | approved | >0 pending | Execution     | Claiming and running tasks         |
| `executing`    | approved | mixed      | Execution     | Active work in progress            |
| `completed`    | any      | all done   | Completion    | Review and wrap-up                 |

**Phase determines what sections to show:**

- **Discovery**: Emphasize memory files, suggest brainstorming or design skills, de-emphasize tasks (none exist).
- **Planning**: Emphasize plan status and comments. If comments exist, highlight them -- they may contain unresolved feedback.
- **Pre-Execution**: Single clear action: run `maestro_tasks_sync` / `maestro task-sync`.
- **Execution**: Full task breakdown with progress, conditions, and next action. This is the most detailed phase.
- **Completion**: Brief summary. Show done count. Suggest `maestro_feature_complete` / `maestro feature-complete`.

## Step 3: Detect Conditions Requiring Attention

Scan the status output for these conditions. Each one requires a specific callout in the report.

| Condition              | Detection Signal                                 | Severity | Action                                                                                   |
|------------------------|--------------------------------------------------|----------|------------------------------------------------------------------------------------------|
| Stale claim (zombie)   | Task is `claimed` but claim has expired          | High     | Wait for `maestro_task_next` to auto-reset it to `pending`, then re-claim                |
| Blocked task           | Task status is `blocked`                         | High     | Review blocker, then `maestro_task_unblock` / `maestro task-unblock` with decision       |
| Unreviewed comments    | `plan.commentCount > 0` and plan is draft        | Medium   | Read comments with `maestro_plan_read` / `maestro plan-read`, address feedback           |
| No tasks synced        | Plan approved but `tasks.total == 0`             | Low      | `maestro_tasks_sync` / `maestro task-sync` to generate tasks                             |
| All pending, dep-blocked | All tasks pending, none runnable               | Low      | Check dependency chain -- start the first task with no unmet dependencies                |

**Severity determines formatting:**
- **High**: Mark with `[!]` prefix. These block progress and must be resolved first.
- **Medium**: Mark with `[~]` prefix. These represent interrupted work or pending feedback.
- **Low**: Mark with `-->` prefix. These are informational next steps.

## Step 4: Present the Status Report

Format the report using phase-aware rules. See `reference/output-templates.md` for concrete examples of every phase and condition.

**General formatting rules:**

1. **Lead with the headline**: Feature name, phase, and overall health in one line.
2. **Show problems first**: Any High or Medium conditions appear before the task list.
3. **Task list**: Show all tasks with status markers. Use alignment for readability.
4. **Progress bar**: For execution phase, show completion as `done/total` with percentage.
5. **Next action**: Always end with the specific command to run next.
6. **Suppress empty sections**: Do not show "Blockers: None" or "Stale Claims: None". Only show sections that have content.

**Phase-specific rules:**

- **Discovery**: Show memory file count if any. Suggest `maestro:brainstorming` or `maestro:design` skills.
- **Planning**: Show plan status prominently. If comments exist, show count and suggest `maestro_plan_read`. If plan is draft, suggest `maestro_plan_write` or `maestro_plan_approve`.
- **Execution**: Full task table. Group by status: claimed first, then blocked, then pending, then done (collapsed if many).
- **Completion**: Brief summary. Show done count. Suggest `maestro_feature_complete`.

## Step 5: Recommend Next Action

The `nextAction` field from `maestro_status` provides the primary recommendation. Use it as the base, then layer on context-aware guidance.

**Enhancement rules based on phase and conditions:**

| Phase     | Condition              | Beyond nextAction                                                          |
|-----------|------------------------|----------------------------------------------------------------------------|
| Discovery | No plan                | Suggest loading `maestro:brainstorming` skill before writing plan          |
| Planning  | Comments exist         | "Address the N comments before seeking approval"                           |
| Planning  | No comments            | "Plan looks clean -- run `maestro_plan_approve` when ready"                |
| Execution | Stale claim detected   | "Stale claim will auto-reset on next `maestro_task_next` call"             |
| Execution | Blocked task           | "Read the blocker report, then unblock: `maestro_task_unblock`"            |
| Execution | Multiple runnable      | "N tasks are ready. Use `maestro_task_next` to get the recommended task."  |
| Execution | All done               | "All tasks complete. Review implementation, then `maestro_feature_complete`"|
| Any       | Zero memory files      | "Consider saving key decisions: `maestro_memory_write`"                    |

**Compound conditions**: When multiple conditions coexist (e.g., stale claim + blocked), prioritize by severity. Address the highest-severity condition first in the recommendation.

## Relationship to Other Commands and Skills

Status is the observability layer across the maestro workflow:

| Command / Skill             | Relationship to Status                                     |
|-----------------------------|------------------------------------------------------------|
| `maestro_feature_create`    | Creates the feature that status reads                      |
| `maestro_plan_write`        | Status tracks plan existence and approval state            |
| `maestro_plan_approve`      | Status detects approved plans and suggests task-sync       |
| `maestro_tasks_sync`        | Generates tasks that status tracks                         |
| `maestro_task_next`         | Finds runnable tasks; auto-resets stale claims to pending  |
| `maestro_task_claim`        | Claims a task; status detects claimed tasks                |
| `maestro_task_done`         | Marks task done; status updates done count                 |
| `maestro_task_block`        | Marks task blocked; status highlights blocker              |
| `maestro_task_unblock`      | Resumes blocked task with decision                         |
| `maestro:brainstorming`     | Status suggests this skill during Discovery phase          |
| `maestro:design`            | Status suggests this skill for complex features            |
| `maestro:implement`         | Load during Execution phase alongside status               |

Run `maestro_status` before and after every significant action to stay oriented.
