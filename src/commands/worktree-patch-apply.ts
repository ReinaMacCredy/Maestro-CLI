/**
 * maestro worktree-patch-apply -- apply worktree changes to the main branch.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'worktree-patch-apply', description: 'Apply worktree changes to main branch' },
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
    base: {
      type: 'string',
      description: 'Base branch or commit for diff (default: HEAD~1)',
    },
  },
  async run({ args }) {
    try {
      const { worktreeAdapter } = getServices();
      const result = await worktreeAdapter.applyDiff(args.feature, args.task, args.base);

      output(result, (r) => {
        if (!r.success) {
          return `[error] worktree-patch-apply: ${r.error}\n[hint] Run worktree-conflicts to inspect conflicting files`;
        }
        if (r.filesAffected.length === 0) {
          return '[ok] No changes to apply.';
        }
        return `[ok] Applied ${r.filesAffected.length} file(s):\n${r.filesAffected.map((f: string) => `  ${f}`).join('\n')}`;
      });
    } catch (err) {
      handleCommandError('worktree-patch-apply', err);
    }
  },
});
