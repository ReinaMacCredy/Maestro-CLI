/**
 * PreToolUse:Agent hook -- inject task spec into agent prompts.
 *
 * When an Agent is spawned for a claimed task, injects:
 * - Compiled task spec (via DCP)
 * - Worker rules (call task_done/task_block)
 * - Relevant feature memories (DCP-scored)
 * - Rich context and graph context (when available)
 *
 * Non-task agents pass through without injection.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { readStdin, writeOutput, resolveProjectDir, logHookError, getSessionsDir } from './_helpers.ts';
import { initServices } from '../services.ts';
import { pruneContext, type PruneContextResult } from '../usecases/prune-context.ts';
import { WORKER_RULES } from '../utils/worker-rules.ts';
import type { TaskInfo } from '../types.ts';
import type { RichTaskFields } from '../ports/tasks.ts';

export { WORKER_RULES };

const TASK_PATTERN = /(?:task[:\s_-]+|(?:^|\s))((?:\d{2}|maestro-[a-z0-9]+)-[a-z0-9-]+)/i;

/** Subset of GraphInsights from ports/graph.ts -- only the fields formatGraphContext needs. */
type GraphInsightsSubset = { criticalPath: Array<{ id: string; title: string }>; bottlenecks: Array<{ id: string; title: string }> };

/** Format rich bead context (design/AC) from getRichFields result. */
export function formatRichContext(
  richResult: PromiseSettledResult<RichTaskFields | null>,
): string {
  const rich = richResult.status === 'fulfilled' ? richResult.value : null;
  if (!rich) return '';
  const parts: string[] = [];
  if (rich.design) parts.push(`## Design Notes\n\n${rich.design}`);
  if (rich.acceptanceCriteria) parts.push(`## Acceptance Criteria\n\n${rich.acceptanceCriteria}`);
  return parts.length > 0 ? '\n' + parts.join('\n\n') + '\n' : '';
}

/** Format graph context (critical path/bottleneck flags) from getInsights result. */
export function formatGraphContext(
  insightsResult: PromiseSettledResult<GraphInsightsSubset | null>,
  taskFolder: string,
  task: TaskInfo,
): string {
  const insights = insightsResult.status === 'fulfilled' ? insightsResult.value : null;
  if (!insights) return '';
  const onCriticalPath = insights.criticalPath.some(n => n.id === taskFolder || n.title === task.name);
  const isBottleneck = insights.bottlenecks.some(n => n.id === taskFolder || n.title === task.name);
  if (!onCriticalPath && !isBottleneck) return '';
  const flags: string[] = [];
  if (onCriticalPath) flags.push('on critical path');
  if (isBottleneck) flags.push('bottleneck (blocks other tasks)');
  return `\n## Graph Context\n\n[!] This task is ${flags.join(' and ')}. Prioritize correctness.\n`;
}

/** Append DCP metrics to JSONL file (best-effort). */
function logDcpMetrics(
  projectDir: string,
  featureName: string,
  taskFolder: string,
  metrics: PruneContextResult['metrics'],
): void {
  try {
    const logDir = getSessionsDir(projectDir);
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, 'dcp-metrics.jsonl');
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      feature: featureName,
      task: taskFolder,
      ...metrics,
    }) + '\n';
    fs.appendFileSync(logPath, entry);
  } catch {
    // Best effort -- never throw from metrics logging
  }
}

async function main(): Promise<void> {
  const input = await readStdin();
  const projectDir = resolveProjectDir();

  if (!projectDir) {
    writeOutput({});
    return;
  }

  // Extract Agent tool input
  const toolInput = (input.tool_input ?? input.input ?? {}) as Record<string, unknown>;
  const prompt = (toolInput.prompt ?? '') as string;

  if (!prompt) {
    writeOutput({});
    return;
  }

  // Check if prompt references a task folder
  const match = prompt.match(TASK_PATTERN);
  if (!match) {
    writeOutput({});
    return;
  }

  const taskFolder = match[1];

  try {
    const services = initServices(projectDir);
    const activeFeature = services.featureAdapter.getActive();
    if (!activeFeature) {
      writeOutput({});
      return;
    }

    const featureName = activeFeature.name;
    const task = await services.taskPort.get(featureName, taskFolder);

    // Accept claimed tasks (fresh or re-claimed from revision)
    if (!task || task.status !== 'claimed') {
      writeOutput({});
      return;
    }

    // Read compiled spec
    const spec = await services.taskPort.readSpec(featureName, taskFolder);
    if (!spec) {
      writeOutput({});
      return;
    }

    // Build revision context if this is a re-claimed task from revision
    let revisionContext = '';
    if (task.revisionCount && task.revisionCount > 0) {
      const verificationReport = await services.taskPort.readVerification(featureName, taskFolder);
      const parts: string[] = [
        `\n## Revision Context (attempt ${task.revisionCount + 1})`,
        '',
      ];
      if (task.revisionFeedback) {
        parts.push(`**Feedback**: ${task.revisionFeedback}`);
      }
      if (verificationReport) {
        const failed = verificationReport.criteria.filter(c => !c.passed);
        if (failed.length > 0) {
          parts.push('', '**Failed checks**:');
          for (const c of failed) {
            parts.push(`- ${c.name}: ${c.detail}`);
          }
        }
        if (verificationReport.suggestions.length > 0) {
          parts.push('', '**Suggestions**:');
          for (const s of verificationReport.suggestions) {
            parts.push(`- ${s}`);
          }
        }
      }
      parts.push('');
      revisionContext = parts.join('\n');
    }

    // Parallelize independent async reads (rich fields + graph insights)
    const [richResult, insightsResult] = await Promise.allSettled([
      services.taskPort.getRichFields?.(featureName, taskFolder) ?? Promise.resolve(null),
      services.graphPort?.getInsights() ?? Promise.resolve(null),
    ]);

    // Format context sections
    const richContext = formatRichContext(richResult as PromiseSettledResult<RichTaskFields | null>);
    const graphContext = formatGraphContext(
      insightsResult as PromiseSettledResult<GraphInsightsSubset | null>,
      taskFolder, task,
    );

    // Read memories with metadata for DCP scoring
    const memories = services.memoryAdapter.listWithMeta(featureName);

    // Get completed tasks for observation masking
    const allTasks = await services.taskPort.list(featureName, { includeAll: true });
    const completedTasks = allTasks
      .filter(t => t.status === 'done' && t.summary)
      .map(t => ({ name: t.name, summary: t.summary! }));

    // Read DCP config
    const dcpConfig = services.configAdapter.get().dcp;

    // Get feature creation time for recency scoring
    const featureInfo = services.featureAdapter.get(featureName);
    const featureCreatedAt = featureInfo?.createdAt;

    // Convert task list to TaskWithDeps for dependency-proximity scoring
    const taskDeps = allTasks.map(t => ({
      folder: t.folder, status: t.status, dependsOn: t.dependsOn,
    }));

    // Prune and assemble
    const { injection, metrics } = pruneContext({
      featureName, taskFolder, task, spec,
      memories, completedTasks,
      richContext, graphContext, revisionContext,
      workerRules: WORKER_RULES,
      dcpConfig, featureCreatedAt,
      allTasks: taskDeps,
    });

    // Log DCP metrics
    logDcpMetrics(projectDir, featureName, taskFolder, metrics);

    writeOutput({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: injection,
      },
    });
  } catch {
    writeOutput({});
  }
}

// Only auto-run when executed directly, not when imported by tests or other modules
const isBunDirect = typeof Bun !== 'undefined' && Bun.main === Bun.resolveSync(import.meta.path, '.');
if (isBunDirect) {
  try {
    await main();
  } catch (error) {
    logHookError(resolveProjectDir(), 'pre-agent', error);
    writeOutput({});
  }
}
