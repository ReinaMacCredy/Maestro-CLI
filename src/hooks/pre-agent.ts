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

const TASK_PATTERN = /(?:task[:\s_-]+|(?:^|\s))(\d{2}-[a-z0-9-]+)/i;

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

    // Read feature memories
    const memories = services.memoryAdapter.list(featureName);
    const memorySection = memories.length > 0
      ? '\n## Feature Memories\n\n' + memories.map(m => `### ${m.name}\n\n${m.content}`).join('\n\n---\n\n')
      : '';

    // Build injection
    const injection = [
      `## Task Spec: ${taskFolder}`,
      '',
      spec,
      '',
      WORKER_RULES,
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
