/**
 * maestro session-fresh -- create a fresh session for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'session-fresh', description: 'Create a fresh session' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    title: {
      type: 'string',
      description: 'Optional session title',
    },
  },
  async run({ args }) {
    try {
      const { sessionAdapter } = getServices();
      const session = sessionAdapter.fresh(args.feature, args.title);
      output(session, (s) => `[ok] fresh session '${s.sessionId}' created`);
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('session-fresh', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
