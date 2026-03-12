/**
 * maestro subtask-create -- create a subtask under a parent task.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'subtask-create', description: 'Create a subtask under a parent task' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    parent: {
      type: 'string',
      description: 'Parent task folder',
      required: true,
    },
    name: {
      type: 'string',
      description: 'Subtask name',
      required: true,
    },
    type: {
      type: 'string',
      description: 'Subtask type (test, implement, review, verify, research, debug, custom)',
    },
  },
  async run({ args }) {
    try {
      const { taskPort } = getServices();
      const result = await taskPort.create(args.feature, args.name, {
        parent: args.parent,
        description: args.type ? `type: ${args.type}` : undefined,
      });

      output(result, (r) =>
        `[ok] subtask created: ${r.folder} (parent: ${args.parent})`,
      );
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('subtask-create', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
