/**
 * maestro ask-cleanup -- cleanup a resolved ask.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'ask-cleanup', description: 'Cleanup a resolved ask' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    id: {
      type: 'string',
      description: 'Ask ID to cleanup',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { askAdapter } = getServices();
      askAdapter.cleanup(args.feature, args.id);
      output({ id: args.id, cleaned: true }, () => `[ok] ask '${args.id}' cleaned up`);
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('ask-cleanup', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
