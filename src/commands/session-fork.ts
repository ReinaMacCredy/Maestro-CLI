/**
 * maestro session-fork -- fork a session from an existing one.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'session-fork', description: 'Fork a session' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    from: {
      type: 'string',
      description: 'Source session ID to fork from (defaults to master)',
    },
  },
  async run({ args }) {
    try {
      const { sessionAdapter } = getServices();
      const session = sessionAdapter.fork(args.feature, args.from);
      output(session, (s) => `[ok] forked session '${s.sessionId}'`);
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('session-fork', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
