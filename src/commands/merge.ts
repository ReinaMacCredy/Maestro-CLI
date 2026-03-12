/**
 * maestro merge -- merge completed task worktree.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { mergeTask } from '../usecases/merge-task.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'merge', description: 'Merge completed task worktree' },
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
    strategy: {
      type: 'string',
      description: 'Merge strategy: merge, squash, rebase',
      default: 'merge',
    },
    keepBranch: {
      type: 'boolean',
      description: 'Keep branch after merge',
      default: false,
    },
  },
  async run({ args }) {
    try {
      const { taskPort, worktreeAdapter } = getServices();
      const result = await mergeTask(taskPort, worktreeAdapter, {
        feature: args.feature,
        task: args.task,
        strategy: args.strategy as 'merge' | 'squash' | 'rebase',
        deleteBranch: !args.keepBranch,
      });

      output(result, (r) => {
        const lines = [`[ok] task '${args.task}' merged`];
        if (r.sha) lines.push(`  sha: ${r.sha}`);
        if (r.filesChanged?.length) lines.push(`  files changed: ${r.filesChanged.length}`);
        if (r.suggestNext?.length) lines.push(`  suggested next: ${r.suggestNext.join(', ')}`);
        return lines.join('\n');
      });
    } catch (err) {
      if (err instanceof MaestroError) {
        console.error(formatError('merge', err.message));
        err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
