/**
 * maestro subtask-report-read -- read a subtask's report.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'subtask-report-read', description: 'Read subtask report' },
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
      const report = await taskPort.readReport(args.feature, args.task);

      if (report === null) {
        console.error(formatError('subtask-report-read', `No report found for subtask '${args.task}'`));
        process.exit(1);
      }

      output({ content: report }, () => report);
    } catch (err) {
      handleCommandError('subtask-report-read', err);
    }
  },
});
