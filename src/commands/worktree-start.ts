/**
 * maestro worktree-start -- start task in isolated worktree.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { startTask } from '../usecases/start-task.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'worktree-start', description: 'Start task in isolated worktree' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    task: {
      type: 'string',
      description: 'Task folder name',
      required: true,
    },
    continueFrom: {
      type: 'string',
      description: 'Continue from blocked state',
    },
    decision: {
      type: 'string',
      description: 'Decision for blocked task',
    },
  },
  async run({ args }) {
    try {
      const { taskPort, featureAdapter, worktreeAdapter, planAdapter, contextAdapter, directory } = getServices();
      const result = await startTask(
        taskPort, featureAdapter, worktreeAdapter, planAdapter, contextAdapter, directory,
        {
          feature: args.feature,
          task: args.task,
          continueFrom: args.continueFrom === 'blocked' ? 'blocked' : undefined,
          decision: args.decision,
        },
      );

      output(result, (r) => {
        const lines = [
          `[ok] worktree ready for task '${args.task}'`,
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
      if (err instanceof MaestroError) {
        console.error(formatError('worktree-start', err.message));
        err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
