/**
 * maestro merge -- merge completed task worktree.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { mergeTask } from '../usecases/merge-task.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

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
      const services = getServices();
      const result = await mergeTask(services, {
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
      handleCommandError('merge', err);
    }
  },
});
