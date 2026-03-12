/**
 * maestro task-spec-read -- read a task's spec.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'task-spec-read', description: 'Read task spec' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    task: {
      type: 'string',
      description: 'Task ID (folder name)',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { taskPort } = getServices();
      const spec = await taskPort.readSpec(args.feature, args.task);

      if (spec === null) {
        console.error(formatError('task-spec-read', `No spec found for task '${args.task}'`));
        process.exit(1);
      }

      output({ content: spec }, () => spec);
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('task-spec-read', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
