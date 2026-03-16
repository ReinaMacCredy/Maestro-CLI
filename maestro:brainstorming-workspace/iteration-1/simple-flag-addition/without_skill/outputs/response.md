# Brainstorming: --verbose flag for status command

This is a straightforward addition. I looked at the implementation and have a few questions before we proceed.

## What's there today

The status command (`src/commands/status/show.ts`) renders each task as a single line:

```
  [pending]      task-folder-name (blocked by: other-task)
```

It uses `TaskInfo` items which have `folder`, `name`, `status`, `planTitle`, and `summary` fields. Currently only `folder` and `status` are shown in the task list. The `planTitle` and `summary` fields are available but unused in the status output.

The list is also capped at 20 items via `truncateList`.

## What "verbose" could mean

A few options, and I want to make sure we're aligned on scope:

1. **Show `planTitle` under each task** -- the title from the plan section that generated the task. This is the most natural "description" since it comes from the plan.

2. **Show `summary`** -- this is the worker-written summary that gets set when a task finishes or is updated. It would be empty for pending tasks.

3. **Show both** -- planTitle as the description, summary as the outcome (when available).

4. **Remove the truncation cap** -- in verbose mode, should we also lift the 20-task truncation limit and show all tasks?

## My recommendation

Option 3 plus lifting the truncation cap. In verbose mode, render something like:

```
  [pending]      001-setup-auth
                 Setup authentication middleware
  [done]         002-add-routes
                 Add REST API routes
                 --> Implemented 4 endpoints with validation
  [in_progress]  003-write-tests
                 Write integration tests
```

Where the second line is `planTitle` and the `-->` line is `summary` (only shown when present). This gives the orchestrator the full picture without needing to run `task-info` on each task individually.

## Implementation questions

1. **Flag name**: `--verbose` or `-v`? Citty supports both long and short forms. I'd add both (`--verbose` / `-v`). Any preference?

2. **Scope creep check**: Should verbose mode also expand other sections? For example, showing plan comment previews, or context file names? I'd say no for now -- keep it focused on task descriptions only, and we can add more later.

3. **JSON output**: The `output()` helper already handles `--json` by dumping the raw `StatusResult`. Since `planTitle` and `summary` are already in `TaskInfo`, verbose doesn't change JSON output at all. Good.

The implementation is small -- roughly:
- Add `verbose` arg to the command definition (3 lines)
- Pass it to `formatStatus` (1 line)
- Conditionally render `planTitle`/`summary` lines and skip truncation (10-15 lines)

Want me to go ahead with option 3, or do you want to adjust the scope?
