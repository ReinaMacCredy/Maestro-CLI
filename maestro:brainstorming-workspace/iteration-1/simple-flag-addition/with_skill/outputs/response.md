# Brainstorming Response: `--verbose` flag for `maestro status`

---

I took a look at the current `status` command. Right now each task line shows only the folder name and status bracket -- something like:

```
  [pending]      add-auth-layer
  [in_progress]  refactor-db-queries
```

`TaskInfo` actually carries `name`, `planTitle`, and `summary` fields, but none of them surface in the status output today. So there is real data sitting behind the scenes that `--verbose` could expose.

Before I jump into approaches, one question to nail down the scope:

**When you say "full task descriptions," which of these do you mean?**

- (a) **The task name / plan title** -- the human-readable title from the plan (e.g., "Add database connection pooling"). Short, one-line.
- (b) **The task summary** -- the freeform text that gets written via `task-update --summary`. Can be multi-line, variable length.
- (c) **Both** -- show the title on the task line, and the summary as an indented block beneath it.
- (d) **Something else** -- maybe you also want to see `startedAt`, `completedAt`, worker session info, or subtask counts.

This matters because (a) is a small tweak to the existing line format, while (b) or (c) changes the output shape more significantly -- each task becomes a multi-line block instead of a single line, and the truncation logic (`truncateList` at 20 items) might need to adapt.
