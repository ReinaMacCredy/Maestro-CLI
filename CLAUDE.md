# maestro -- Agent-Optimized Development Orchestrator

## Getting Started

At the start of every session:

```bash
maestro status                    # current feature state, runnable tasks, blockers
maestro skill <name>              # load workflow skill (see Skills System below)
```

## Workflow Phases

| Phase | Trigger | Commands |
|-------|---------|----------|
| **Discovery** | New feature request | `maestro feature-create <name>`, explore codebase, `maestro context-write --feature <name> --name <file> --content "..."` |
| **Planning** | Feature exists, no plan | `maestro plan-write --feature <name> --content "..."`, `maestro plan-read --feature <name>` |
| **Approval** | Plan written | `maestro plan-approve --feature <name>` (after addressing all comments) |
| **Execution** | Plan approved | `maestro task-sync --feature <name>`, `maestro worktree-start --feature <name> --task <id>`, `maestro merge --feature <name> --task <id>` |
| **Completion** | All tasks done + merged | `maestro feature-complete --feature <name>` |

## Skills System

11 bundled workflow skills. Load with `maestro skill <name>`, list with `maestro skill-list`.

| Phase | Skills |
|-------|--------|
| Discovery / Planning | `writing-plans`, `parallel-exploration`, `brainstorming` |
| Orchestration | `executing-plans`, `dispatching-parallel-agents` |
| Code Review | `code-reviewer`, `verification-before-completion` |
| Debugging | `systematic-debugging` |
| Testing | `test-driven-development` |
| Infrastructure | `agents-md-mastery`, `docker-mastery` |

Load all recommended skills shown in `maestro status` output at session start.

## Planning Mode

1. Load skills: `maestro skill writing-plans`, `maestro skill parallel-exploration`
2. Ask clarifying questions about the feature
3. Research the codebase, save findings: `maestro context-write --feature <name> --name <file> --content "..."`
4. Write plan: `maestro plan-write --feature <name> --content "..."`
   - Must include a `## Discovery` section (min 100 chars)
   - Must include `## Non-Goals` and `## Ghost Diffs` sections
5. User reviews, adds comments via `maestro plan-read --feature <name>`
6. Revise plan, then: `maestro plan-approve --feature <name>`

## Orchestration Mode

1. Load skills: `maestro skill executing-plans`, `maestro skill dispatching-parallel-agents`
2. `maestro task-sync --feature <name>` -- generate tasks from approved plan
3. `maestro status` -- find runnable tasks (respects dependency ordering)
4. For each runnable task: `maestro worktree-start --feature <name> --task <id>`
   - Returns `workerPromptPath` and delegation instructions
5. Spawn worker using Claude Code's Agent tool (see Worker Delegation below)
6. After worker completes: `maestro merge --feature <name> --task <id>`
7. Repeat for next runnable task

## Worker Delegation

When `maestro worktree-start` or `maestro worktree-create` returns `delegationRequired: true`:

```
Agent({
  prompt: "Read and follow the instructions in <workerPromptPath>",
  isolation: "worktree"
})
```

The worker prompt contains full context: spec, protocols, guidelines.
Do NOT inline the prompt -- let the Agent read the file.

Workers auto-receive TDD and verification guidance in their prompt. For the orchestrator (you), load skills explicitly.

## Blocked Tasks

If a worker reports a blocker:

1. Task status changes to "blocked" -- visible in `maestro status`
2. Review the blocker info (reason, options, recommendation, context)
3. Get user input on the decision
4. Resume: `maestro worktree-create --feature <name> --task <id> --continueFrom blocked --decision "user's answer"`

A NEW worker spawns in the SAME worktree. Previous progress is preserved.

## Command Reference

64 commands organized by domain:

### Feature (5)

| Command | Purpose |
|---------|---------|
| `feature-create` | Create a new feature |
| `feature-list` | List all features |
| `feature-info` | Show feature details |
| `feature-active` | Show active feature |
| `feature-complete` | Mark feature done |

### Plan (6)

| Command | Purpose |
|---------|---------|
| `plan-write` | Write or update plan |
| `plan-read` | Read plan + comments |
| `plan-approve` | Approve plan for execution |
| `plan-revoke` | Revoke plan approval |
| `plan-comment` | Add comment to plan |
| `plan-comments-clear` | Clear all plan comments |

### Task (9)

| Command | Purpose |
|---------|---------|
| `task-sync` | Generate tasks from approved plan |
| `task-create` | Manually create a task |
| `task-update` | Update task status/summary |
| `task-list` | List tasks with status |
| `task-info` | Show task details |
| `task-spec-read` | Read task spec |
| `task-spec-write` | Write task spec |
| `task-report-read` | Read task report |
| `task-report-write` | Write task report |

### Subtask (9)

| Command | Purpose |
|---------|---------|
| `subtask-create` | Create a subtask |
| `subtask-update` | Update subtask status |
| `subtask-list` | List subtasks |
| `subtask-info` | Show subtask details |
| `subtask-delete` | Delete a subtask |
| `subtask-spec-read` | Read subtask spec |
| `subtask-spec-write` | Write subtask spec |
| `subtask-report-read` | Read subtask report |
| `subtask-report-write` | Write subtask report |

### Worktree (8)

| Command | Purpose |
|---------|---------|
| `worktree-start` | Start task in isolated worktree |
| `worktree-commit` | Complete/block/fail task |
| `worktree-list` | List active worktrees |
| `worktree-diff` | Show worktree changes |
| `worktree-conflicts` | Check merge conflicts |
| `worktree-cleanup` | Clean up stale worktrees |
| `worktree-discard` | Abort and discard worktree |
| `worktree-create` | Resume blocked task / create worktree |

### Merge (1)

| Command | Purpose |
|---------|---------|
| `merge` | Merge completed task branch into main |

### Context (7)

| Command | Purpose |
|---------|---------|
| `context-write` | Save context/decisions |
| `context-read` | Read a context file |
| `context-list` | List context files |
| `context-delete` | Delete a context file |
| `context-compile` | Compile all context into summary |
| `context-archive` | Archive context files |
| `context-stats` | Show context statistics |

### Session (5)

| Command | Purpose |
|---------|---------|
| `session-track` | Track current session |
| `session-list` | List sessions |
| `session-master` | Show master session |
| `session-fork` | Fork from existing session |
| `session-fresh` | Start fresh session |

### Ask (4)

| Command | Purpose |
|---------|---------|
| `ask-create` | Create a question for user |
| `ask-answer` | Answer a pending question |
| `ask-list` | List pending questions |
| `ask-cleanup` | Clean up resolved questions |

### Config (3)

| Command | Purpose |
|---------|---------|
| `config-get` | Get configuration value |
| `config-set` | Set configuration value |
| `config-agent` | Configure agent settings |

### Other (7)

| Command | Purpose |
|---------|---------|
| `init` | Initialize maestro for a project |
| `status` | Show feature status overview |
| `agents-md` | Manage AGENTS.md |
| `sandbox-status` | Show sandbox configuration |
| `sandbox-wrap` | Wrap command for sandbox execution |
| `skill` | Load a workflow skill |
| `skill-list` | List available skills |

All commands accept `--json` for machine-readable output. Use `maestro <command> --help` for full usage.
