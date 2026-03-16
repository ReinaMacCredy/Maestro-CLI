---
name: maestro:plan-review-loop
description: "Deep-review any plan (maestro, Codex, Claude Code plan mode, or plain markdown) using iterative subagent review loops. Spawns reviewer subagents that find issues, fixes them, re-reviews until the plan passes with zero actionable issues. Use when the user says 'review the plan', 'deep review', 'check the plan thoroughly', 'review loop', 'validate before approving', or wants rigorous plan validation before execution. Also use proactively before plan-approve when the plan is complex or high-risk."
---

# Plan Review Loop -- Redirect

This skill is maintained in the maestro built-in skills registry. Load the full version:

```
maestro skill maestro:plan-review-loop
```

The built-in version includes review dimensions reference and the full iterative loop protocol. Loading it from maestro ensures you always get the latest version.
