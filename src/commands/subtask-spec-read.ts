/**
 * maestro subtask-spec-read -- read a subtask's spec.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'subtask-spec-read', description: 'Read subtask spec' },
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
      const spec = await taskPort.readSpec(args.feature, args.task);

      if (spec === null) {
        console.error(formatError('subtask-spec-read', `No spec found for subtask '${args.task}'`));
        process.exit(1);
      }

      output({ content: spec }, () => spec);
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('subtask-spec-read', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
