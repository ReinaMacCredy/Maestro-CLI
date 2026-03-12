/**
 * maestro ask-list -- list pending asks for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output, renderTable } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'ask-list', description: 'List pending asks' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { askAdapter } = getServices();
      const asks = askAdapter.listPending(args.feature);
      output(asks, (items) => {
        if (items.length === 0) return 'No pending asks.';
        const rows = items.map((a: { id: string; question: string; timestamp: string }) => [
          a.id,
          a.question.length > 60 ? a.question.substring(0, 57) + '...' : a.question,
          a.timestamp,
        ]);
        return renderTable(['ID', 'Question', 'Created'], rows);
      });
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('ask-list', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
