/**
 * verifyTask -- orchestrate verification checks and state transitions.
 *
 * Flow:
 *   1. Read task status for claimedAt and revisionCount
 *   2. If verification disabled: taskPort.done(), return auto-pass
 *   3. If autoAcceptTypes match: skip verification, taskPort.done()
 *   4. Run verification checks
 *   5. Write verification.json
 *   6. If passed: taskPort.done(), return { report, newStatus: 'done' }
 *   7. If failed: taskPort.review(), return { report, newStatus: 'review' }
 *      (MCP handler decides the next step -- autoReject, maxRevisions, etc.)
 */

import type { TaskPort } from '../ports/tasks.ts';
import type { VerificationPort, VerificationReport } from '../ports/verification.ts';
import type { MemoryPort } from '../ports/memory.ts';
import type { ResolvedVerificationConfig } from '../utils/verification-config.ts';
import type { TaskInfo } from '../types.ts';

export interface VerifyTaskResult {
  report: VerificationReport;
  newStatus: 'done' | 'review';
  task: TaskInfo;
}

export async function verifyTask(
  taskPort: TaskPort,
  verificationPort: VerificationPort,
  memoryAdapter: MemoryPort | undefined,
  config: ResolvedVerificationConfig,
  projectRoot: string,
  featureName: string,
  taskFolder: string,
  summary: string,
): Promise<VerifyTaskResult> {
  // Read current task state
  const task = await taskPort.get(featureName, taskFolder);
  if (!task) throw new Error(`Task '${taskFolder}' not found`);

  // Verification disabled -- direct done
  if (!config.enabled) {
    const doneTask = await taskPort.done(featureName, taskFolder, summary);
    const autoPass: VerificationReport = {
      passed: true,
      score: 1,
      criteria: [],
      suggestions: [],
      timestamp: new Date().toISOString(),
    };
    return { report: autoPass, newStatus: 'done', task: doneTask };
  }

  // Auto-accept types -- skip verification for matching task types
  if (config.autoAcceptTypes.length > 0) {
    const spec = await taskPort.readSpec(featureName, taskFolder);
    const richFields = await taskPort.getRichFields?.(featureName, taskFolder);
    const taskType = richFields?.type ?? inferTaskType(spec);
    if (taskType && config.autoAcceptTypes.includes(taskType)) {
      const doneTask = await taskPort.done(featureName, taskFolder, summary);
      const autoPass: VerificationReport = {
        passed: true,
        score: 1,
        criteria: [{ name: 'auto-accept', passed: true, detail: `Task type '${taskType}' auto-accepted` }],
        suggestions: [],
        timestamp: new Date().toISOString(),
      };
      return { report: autoPass, newStatus: 'done', task: doneTask };
    }
  }

  // Run verification checks
  const spec = await taskPort.readSpec(featureName, taskFolder);
  const richFields = await taskPort.getRichFields?.(featureName, taskFolder);

  const report = await verificationPort.verify({
    projectRoot,
    featureName,
    taskFolder,
    summary,
    specContent: spec ?? undefined,
    acceptanceCriteria: richFields?.acceptanceCriteria ?? undefined,
    claimedAt: task.claimedAt,
  });

  // Write verification report
  await taskPort.writeVerification(featureName, taskFolder, report);

  if (report.passed) {
    const doneTask = await taskPort.done(featureName, taskFolder, summary);
    return { report, newStatus: 'done', task: doneTask };
  }

  // Verification failed -- transition to review (MCP handler decides next step)
  const reviewTask = await taskPort.review(featureName, taskFolder, summary);

  // Write failure memory for future reference
  if (memoryAdapter) {
    try {
      const failedCriteria = report.criteria.filter(c => !c.passed).map(c => c.name).join(', ');
      const content = [
        '---',
        'tags: [verification, failure-pattern]',
        'category: debug',
        'priority: 1',
        '---',
        '',
        `Verification failed for ${taskFolder}: ${failedCriteria}.`,
        `Score: ${report.score.toFixed(2)}.`,
        `Suggestions: ${report.suggestions.join('; ')}`,
      ].join('\n');
      memoryAdapter.write(featureName, `verification-fail-${taskFolder}`, content);
    } catch {
      // Memory write is best-effort
    }
  }

  return { report, newStatus: 'review', task: reviewTask };
}

function inferTaskType(spec: string | null): string | undefined {
  if (!spec) return undefined;
  const lower = spec.toLowerCase();
  if (lower.includes('## task type')) {
    const match = spec.match(/## Task Type\s*\n\s*(\w+)/i);
    return match?.[1]?.toLowerCase();
  }
  return undefined;
}
