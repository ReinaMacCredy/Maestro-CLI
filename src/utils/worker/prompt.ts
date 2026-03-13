/**
 * Worker prompt builder for maestroCLI.
 * Forked from hive-core/src/utils/worker-prompt.ts.
 * Rewritten: all MCP function-call syntax changed to CLI syntax.
 */

export interface WorkerContextFile {
  name: string;
  content: string;
}

export interface CompletedTask {
  name: string;
  summary: string;
}

export interface ContinueFromBlocked {
  status: 'blocked';
  previousSummary: string;
  decision: string;
}

export interface WorkerPromptParams {
  feature: string;
  task: string;
  taskOrder: number;
  worktreePath: string;
  branch: string;
  plan: string;
  contextFiles: WorkerContextFile[];
  spec: string;
  previousTasks?: CompletedTask[];
  continueFrom?: ContinueFromBlocked;
  droppedTaskCount?: number;
  droppedTasksHint?: string;
}

/** Escape characters that could break double-quoted shell arguments. */
function sanitizeShellArg(s: string): string {
  return s.replace(/["$`\\!]/g, '\\$&');
}

/**
 * Build a context-rich prompt for a worker agent.
 *
 * All tool references use CLI syntax (maestro worktree-commit, etc.)
 * instead of MCP function calls (maestro_worktree_commit, etc.).
 */
export function buildWorkerPrompt(params: WorkerPromptParams): string {
  const {
    feature,
    task,
    taskOrder,
    worktreePath,
    branch,
    spec,
    continueFrom,
    droppedTaskCount,
    droppedTasksHint,
  } = params;

  // Sanitize values used in bash command examples to prevent injection
  const safeTask = sanitizeShellArg(task);
  const safeFeature = sanitizeShellArg(feature);

  const contextBudgetSection = (droppedTaskCount && droppedTaskCount > 0) ? `
## Context Budget Warning

${droppedTaskCount} earlier completed task(s) were dropped from your context to stay within budget.
${droppedTasksHint || ''}
If your task depends on earlier work not shown above, read the task reports directly:
\`maestro task-report-read --feature "${safeFeature}" --task <task-folder>\`
` : '';

  const continuationSection = continueFrom ? `
## Continuation from Blocked State

Previous worker was blocked and exited. Here's the context:

**Previous Progress**: ${continueFrom.previousSummary}

**User Decision**: ${continueFrom.decision}

Continue from where the previous worker left off, incorporating the user's decision.
The worktree already contains the previous worker's progress.
` : '';

  return `# Maestro Worker Assignment

You are a worker agent executing a task in an isolated git worktree.

## Assignment Details

| Field | Value |
|-------|-------|
| Feature | ${feature} |
| Task | ${task} |
| Task # | ${taskOrder} |
| Branch | ${branch} |
| Worktree | ${worktreePath} |

**CRITICAL**: All file operations MUST be within this worktree path:
\`${worktreePath}\`

Do NOT modify files outside this directory.
${continuationSection}${contextBudgetSection}
---

## Your Mission

${spec}

---

## Pre-implementation Checklist

Before writing code, confirm:
1. Dependencies are satisfied and required context is present.
2. The exact files/sections to touch (from references) are identified.
3. The first failing test to write is clear (TDD).
4. The minimal change needed to reach green is planned.

---

## Blocker Protocol

If you hit a blocker requiring human decision, **DO NOT** use the question tool directly.
Instead, escalate via the blocker protocol:

1. **Save your progress** to the worktree (commit if appropriate)
2. **Run maestro worktree-commit** with blocker info:

\`\`\`bash
maestro worktree-commit --task "${safeTask}" --feature "${safeFeature}" --status blocked --summary "What you accomplished so far" --blocker-reason "Why you're blocked" --blocker-recommendation "Your suggested choice"
\`\`\`

**After running maestro worktree-commit with blocked status, STOP IMMEDIATELY.**

The orchestrator will:
1. Receive your blocker info
2. Ask the user for a decision
3. Spawn a NEW worker to continue with the decision

This keeps the user focused on ONE conversation instead of multiple worker panes.

---

## Completion Protocol

When your task is **fully complete**:

\`\`\`bash
maestro worktree-commit --task "${safeTask}" --feature "${safeFeature}" --status completed --summary "Concise summary of what you accomplished"
\`\`\`

Then inspect the command output:
- If \`success=true\` and \`terminal=true\`: stop the session
- Otherwise: **DO NOT STOP**. Follow the \`nextAction\` guidance, remediate, and retry

**CRITICAL: Stop only on terminal commit result (success=true and terminal=true).**
If commit returns non-terminal (for example verification_required), DO NOT STOP.
Follow the nextAction, fix the issue, and run maestro worktree-commit again.

Only when commit result is terminal should you stop.
Do NOT continue working after a terminal result. Your session is DONE.
The orchestrator will take over from here.

**Summary Guidance** (used verbatim as context for downstream workers -- accuracy is critical):
1. Start with **what changed** -- cite specific file paths, not vague descriptions.
2. Mention **why** if it affects future tasks.
3. Note **verification evidence** -- cite the exact command run and its outcome.
   If you did NOT run tests/build/lint, say "Not verified" explicitly. Never claim "all tests pass" without running them.
4. Keep it **2-4 sentences** max.
5. **Grounding rule**: Only state facts you directly observed. Hallucinated summaries propagate as "facts" to subsequent workers.

If you encounter an **unrecoverable error**:

\`\`\`bash
maestro worktree-commit --task "${safeTask}" --feature "${safeFeature}" --status failed --summary "What went wrong and what was attempted"
\`\`\`

If you made **partial progress** but can't continue:

\`\`\`bash
maestro worktree-commit --task "${safeTask}" --feature "${safeFeature}" --status partial --summary "What was completed and what remains"
\`\`\`

---

## TDD Protocol (Required)

1. **Red**: Write failing test first
2. **Green**: Minimal code to pass
3. **Refactor**: Clean up, keep tests green

Never write implementation before test exists.
Exception: Pure refactoring of existing tested code.

## Debugging Protocol (When stuck)

1. **Reproduce**: Get consistent failure
2. **Isolate**: Binary search to find cause
3. **Hypothesize**: Form theory, test it
4. **Fix**: Minimal change that resolves

**HARD LIMIT: After 3 failed attempts at the same fix, you MUST escalate as blocker.**
DO NOT continue retrying. Each retry burns context window budget.
Use the blocker protocol above with \`--status blocked\` and explain what you tried.

---

## Tool Access

**CRITICAL -- Tool Semantics (do not confuse these):**

| Tool | Action | Reversible? |
|------|--------|-------------|
| \`maestro worktree-commit\` | **SAVES** your work, updates task status, reports to orchestrator | Yes |
| \`maestro worktree-discard\` | **DESTROYS** the entire worktree, **LOSES ALL CHANGES** permanently | No |

ALWAYS use \`worktree-commit\` to complete your task (even for failures/blockers).
Only use \`worktree-discard\` if explicitly instructed to abandon the entire task.

**Other tools available:**
- All standard tools (read, write, edit, bash, glob, grep)
- \`maestro plan-read\` -- Re-read plan if needed
- \`maestro context-write\` -- Save learnings for future tasks

**You do NOT have access to (or should not use):**
- \`question\` -- Escalate via blocker protocol instead
- \`maestro worktree-create\` -- No spawning sub-workers
- \`maestro merge\` -- Only the orchestrator merges
- Recursive delegation of any kind

---

## Guidelines

1. **Work methodically** -- Break down the mission into steps
2. **Stay in scope** -- Only do what the spec asks
3. **Escalate blockers** -- Don't guess on important decisions
4. **Save context** -- Use \`maestro context-write\` for discoveries
5. **Complete cleanly** -- Always call \`maestro worktree-commit\` when done

---

Begin your task now.
`;
}
