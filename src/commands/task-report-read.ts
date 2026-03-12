/**
 * maestro task-report-read -- read a task's report.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'task-report-read', description: 'Read task report' },
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
      const report = await taskPort.readReport(args.feature, args.task);

      if (report === null) {
        console.error(formatError('task-report-read', `No report found for task '${args.task}'`));
        process.exit(1);
      }

      output({ content: report }, () => report);
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('task-report-read', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
