/**
 * maestro worktree-discard -- discard worktree (abort task).
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'worktree-discard', description: 'Discard worktree (abort task)' },
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
    'keep-branch': {
      type: 'boolean',
      description: 'Keep the git branch after removing worktree',
      default: false,
    },
  },
  async run({ args }) {
    try {
      const { worktreeAdapter } = getServices();
      const keepBranch = args['keep-branch'] ?? false;
      await worktreeAdapter.remove(args.feature, args.task, !keepBranch);

      output({ feature: args.feature, task: args.task, keepBranch }, () => {
        return `[ok] Worktree discarded for task '${args.task}'${keepBranch ? ' (branch kept)' : ''}`;
      });
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('worktree-discard', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
