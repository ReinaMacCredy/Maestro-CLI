/**
 * maestro worktree-diff -- show worktree diff.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'worktree-diff', description: 'Show worktree diff' },
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
  },
  async run({ args }) {
    try {
      const { worktreeAdapter } = getServices();
      const result = await worktreeAdapter.getDiff(args.feature, args.task);

      output(result, (r) => {
        if (!r.hasDiff) {
          return 'No changes.';
        }
        const lines = [
          `${r.filesChanged.length} file(s) changed  +${r.insertions} -${r.deletions}`,
          '',
          r.diffContent,
        ];
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('worktree-diff', err);
    }
  },
});
