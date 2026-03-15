/**
 * Worker prompt builder for maestroCLI.
 * All workflow references use direct CLI commands.
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

export interface ContinueFromPartial {
  status: 'partial';
  previousSummary: string;
}

export type ContinueFrom = ContinueFromBlocked | ContinueFromPartial;
export type ContinueFromStatus = ContinueFrom['status'];

export interface WorkerPromptParams {
  feature: string;
  task: string;
  taskOrder: number;
  workspacePath: string;
  plan: string;
  contextFiles: WorkerContextFile[];
  spec: string;
  previousTasks?: CompletedTask[];
  continueFrom?: ContinueFrom;
  droppedTaskCount?: number;
  droppedTasksHint?: string;
}

function sanitizeShellArg(value: string): string {
  return value.replace(/["$`\\!]/g, '\\$&');
}

export function buildWorkerPrompt(params: WorkerPromptParams): string {
  const {
    feature,
    task,
    taskOrder,
    workspacePath,
    spec,
    continueFrom,
    droppedTaskCount,
    droppedTasksHint,
  } = params;

  const safeTask = sanitizeShellArg(task);
  const safeFeature = sanitizeShellArg(feature);

  const contextBudgetSection = (droppedTaskCount && droppedTaskCount > 0) ? `
## Context Budget Warning

${droppedTaskCount} earlier completed task(s) were dropped from your context to stay within budget.
${droppedTasksHint || ''}
If your task depends on earlier work not shown above, read the task reports directly:
\`maestro task-report-read --feature "${safeFeature}" --task <task-folder>\`
` : '';

  let continuationSection = '';
  if (continueFrom?.status === 'blocked') {
    continuationSection = `
## Continuation From Blocked State

Previous worker summary: ${continueFrom.previousSummary}

User decision: ${continueFrom.decision}

Continue from the current files on disk. Do not restart from scratch unless the current checkout is clearly unusable.
`;
  } else if (continueFrom?.status === 'partial') {
    continuationSection = `
## Continuation From Partial State

Previous worker summary: ${continueFrom.previousSummary}

Continue from the current files on disk. Review what already changed before making new edits.
`;
  }

  return `# Maestro Worker Assignment

You are a worker agent executing task ${task} for feature ${feature}.

## Assignment Details

| Field | Value |
|-------|-------|
| Feature | ${feature} |
| Task | ${task} |
| Task # | ${taskOrder} |
| Workspace | ${workspacePath} |

**CRITICAL**: Operate only inside this project checkout:
\`${workspacePath}\`

Do not create worktrees, do not spawn sub-workers, and do not hand work back without calling \`maestro task-finish\`.
${continuationSection}${contextBudgetSection}
---

## Your Mission

${spec}

---

## Pre-implementation Checklist

Before writing code, confirm:
1. Dependencies are satisfied and required context is present.
2. The exact files/sections to touch are identified.
3. The first failing test to write is clear.
4. The minimal change needed to reach green is planned.

---

## Blocker Protocol

If you hit a blocker requiring human decision, do **not** ask the user directly from this worker.

Instead, run:

\`\`\`bash
maestro task-finish --task "${safeTask}" --feature "${safeFeature}" --status blocked --summary "What you accomplished so far" --blocker-reason "Why you're blocked" --blocker-recommendation "Your suggested choice"
\`\`\`

After \`maestro task-finish\` with blocked status, stop immediately.

---

## Completion Protocol

When the task is fully complete:

\`\`\`bash
maestro task-finish --task "${safeTask}" --feature "${safeFeature}" --status completed --summary "Concise summary of what you accomplished"
\`\`\`

If you encounter an unrecoverable error:

\`\`\`bash
maestro task-finish --task "${safeTask}" --feature "${safeFeature}" --status failed --summary "What went wrong and what was attempted"
\`\`\`

If you made partial progress but cannot finish:

\`\`\`bash
maestro task-finish --task "${safeTask}" --feature "${safeFeature}" --status partial --summary "What was completed and what remains"
\`\`\`

After \`maestro task-finish\`, stop. The orchestrator will interpret the result and decide the next step.

**Summary guidance**:
1. Start with what changed, citing concrete file paths.
2. Mention why only if it matters to later tasks.
3. Include exact verification performed, or say "Not verified".
4. Keep it to 2-4 sentences.
5. Only state facts you directly observed.

---

## TDD Protocol

1. Red: write or update the failing test first
2. Green: make the minimal code change to pass
3. Refactor: clean up while keeping tests green

Do not skip tests unless the task is a pure refactor of already-tested code.

## Debugging Protocol

1. Reproduce
2. Isolate
3. Hypothesize
4. Fix

After 3 failed attempts at the same fix, stop and use the blocker protocol.

---

## Tool Access

Use the normal coding tools plus:
- \`maestro plan-read\`
- \`maestro context-write\`
- \`maestro task-report-read\`
- \`maestro task-finish\`

Do not use:
- recursive delegation of any kind
- any \`maestro worktree-*\` command

---

Begin the task now.
`;
}
