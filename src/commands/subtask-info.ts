/**
 * maestro subtask-info -- show subtask details.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output, renderStatusLine } from '../lib/output.ts';
import { formatError, handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'subtask-info', description: 'Show subtask details' },
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
      const info = await taskPort.get(args.feature, args.task);

      if (!info) {
        console.error(formatError('subtask-info', `Subtask '${args.task}' not found in feature '${args.feature}'`));
        process.exit(1);
      }

      output(info, (t) =>
        [
          renderStatusLine('Folder', t.folder),
          renderStatusLine('Name', t.name),
          renderStatusLine('Status', t.status),
          renderStatusLine('Origin', t.origin),
          t.planTitle ? renderStatusLine('Plan title', t.planTitle) : null,
          t.summary ? renderStatusLine('Summary', t.summary) : null,
          t.dependsOn?.length ? renderStatusLine('Depends on', t.dependsOn.join(', ')) : null,
        ].filter(Boolean).join('\n'),
      );
    } catch (err) {
      handleCommandError('subtask-info', err);
    }
  },
});
