/**
 * maestro worktree-create -- create worktree for resuming blocked tasks.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { startTask } from '../usecases/start-task.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'worktree-create', description: 'Create worktree (resume blocked task)' },
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
          `[ok] Worktree created for task '${args.task}'`,
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
      handleCommandError('worktree-create', err);
    }
  },
});
