/**
 * maestro subtask-delete -- delete (cancel) a subtask.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'subtask-delete', description: 'Delete (cancel) a subtask' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    task: {
      type: 'string',
      description: 'Subtask ID (folder name)',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { taskPort } = getServices();
      const result = await taskPort.close(args.feature, args.task, 'cancelled');

      output(result, (r) => {
        const lines = [`[ok] subtask '${args.task}' deleted (cancelled)`];
        if (r.suggestNext?.length) lines.push(`  suggested next: ${r.suggestNext.join(', ')}`);
        return lines.join('\n');
      });
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('subtask-delete', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
