/**
 * PreToolUse:Agent hook -- inject task spec into agent prompts.
 *
 * When an Agent is spawned for a claimed task, injects:
 * - Compiled task spec
 * - Worker rules (call task_done/task_block)
 * - Feature memories
 *
 * Non-task agents pass through without injection.
 */

import { readStdin, writeOutput, resolveProjectDir, logHookError } from './_helpers.ts';
import { initServices } from '../services.ts';

const TASK_PATTERN = /(?:task[:\s_-]+|(?:^|\s))((?:\d{2}|maestro-[a-z0-9]+)-[a-z0-9-]+)/i;

const WORKER_RULES = `
## Worker Rules
- Call maestro_task_done with a summary when your work is complete.
- Call maestro_task_block with a reason if you are stuck and need a decision.
- Do not start or claim other tasks.
- Focus exclusively on the task described in this spec.
`.trim();

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

    // Read feature memories (capped at 4KB to limit token injection)
    const MAX_MEMORY_BYTES = 4096;
    const memories = services.memoryAdapter.list(featureName);
    let memorySection = memories.length > 0
      ? '\n## Feature Memories\n\n' + memories.map(m => `### ${m.name}\n\n${m.content}`).join('\n\n---\n\n')
      : '';
    if (memorySection.length > MAX_MEMORY_BYTES) {
      const truncated = memorySection.slice(0, MAX_MEMORY_BYTES);
      const lastNewline = truncated.lastIndexOf('\n');
      memorySection = (lastNewline > 0 ? truncated.slice(0, lastNewline) : truncated)
        + '\n\n[truncated -- use maestro_memory_read for full content]';
    }

    // Rich bead context (when br backend provides design/AC)
    let richContext = '';
    if (services.taskPort.getRichFields) {
      try {
        const rich = await services.taskPort.getRichFields(featureName, taskFolder);
        if (rich) {
          const parts: string[] = [];
          if (rich.design) parts.push(`## Design Notes\n\n${rich.design}`);
          if (rich.acceptanceCriteria) parts.push(`## Acceptance Criteria\n\n${rich.acceptanceCriteria}`);
          if (parts.length > 0) richContext = '\n' + parts.join('\n\n') + '\n';
        }
      } catch { /* rich fields unavailable */ }
    }

    // Graph context (when bv available)
    let graphContext = '';
    if (services.graphPort) {
      try {
        const insights = await services.graphPort.getInsights();
        const onCriticalPath = insights.criticalPath.some(n => n.id === taskFolder || n.title === task.name);
        const isBottleneck = insights.bottlenecks.some(n => n.id === taskFolder || n.title === task.name);
        if (onCriticalPath || isBottleneck) {
          const flags: string[] = [];
          if (onCriticalPath) flags.push('on critical path');
          if (isBottleneck) flags.push('bottleneck (blocks other tasks)');
          graphContext = `\n## Graph Context\n\n[!] This task is ${flags.join(' and ')}. Prioritize correctness.\n`;
        }
      } catch { /* bv unavailable */ }
    }

    // Build injection
    const injection = [
      `## Task Spec: ${taskFolder}`,
      '',
      spec,
      richContext,
      WORKER_RULES,
      graphContext,
      memorySection,
    ].join('\n');

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

try {
  await main();
} catch (error) {
  logHookError(resolveProjectDir(), 'pre-agent', error);
  writeOutput({});
}
