/**
 * maestro subtask-report-write -- write a subtask's report.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'subtask-report-write', description: 'Write subtask report' },
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
    content: {
      type: 'string',
      description: 'Report content',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { taskPort } = getServices();
      await taskPort.writeReport(args.feature, args.task, args.content);

      output({ task: args.task }, () =>
        `[ok] report written for subtask '${args.task}'`,
      );
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('subtask-report-write', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
