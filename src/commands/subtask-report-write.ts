/**
 * maestro subtask-report-write -- write a subtask's report.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

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
      handleCommandError('subtask-report-write', err);
    }
  },
});
