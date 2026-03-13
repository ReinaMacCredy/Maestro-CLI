/**
 * maestro worktree-start / worktree-create -- start task in isolated worktree.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { startTask } from '../usecases/start-task.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

export function makeWorktreeStartCommand(name: string, description: string, successPrefix: string) {
  return defineCommand({
    meta: { name, description },
    args: {
      feature: { type: 'string' as const, description: 'Feature name', required: true },
      task: { type: 'string' as const, description: 'Task folder name', required: true },
      continueFrom: { type: 'string' as const, description: 'Continue from blocked state' },
      decision: { type: 'string' as const, description: 'Decision for blocked task' },
    },
    async run({ args }) {
      try {
        const services = getServices();
        const result = await startTask(services, {
          feature: args.feature,
          task: args.task,
          continueFrom: args.continueFrom === 'blocked' ? 'blocked' : undefined,
          decision: args.decision,
        });

        output(result, (r) => {
          const lines = [
            `[ok] ${successPrefix} '${args.task}'`,
            `  path: ${r.worktreePath}`,
            `  branch: ${r.branch}`,
            `  prompt: ${r.workerPromptPath}`,
          ];
          if (r.delegationRequired) {
            lines.push(`  [!] delegation required: spawn worker agent with prompt file`);
          }
          return lines.join('\n');
        });
      } catch (err) {
        handleCommandError(name, err);
      }
    },
  });
}

export default makeWorktreeStartCommand('worktree-start', 'Start task in isolated worktree', 'worktree ready for task');
