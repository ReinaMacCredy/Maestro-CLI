/**
 * maestro worktree-conflicts -- check for merge conflicts.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output, renderList } from '../../lib/output.ts';
import { handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'worktree-conflicts', description: 'Check for merge conflicts' },
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
      const conflicts = await worktreeAdapter.checkConflicts(args.feature, args.task);

      output(conflicts, (files: string[]) => {
        if (files.length === 0) {
          return '[ok] No conflicts detected.';
        }
        return `[!] ${files.length} conflicting file(s):\n${renderList(files)}`;
      });
    } catch (err) {
      handleCommandError('worktree-conflicts', err);
    }
  },
});
