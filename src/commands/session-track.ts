/**
 * maestro session-track -- track a session for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'session-track', description: 'Track a session' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    sessionId: {
      type: 'string',
      description: 'Session ID',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { sessionAdapter } = getServices();
      const session = sessionAdapter.track(args.feature, args.sessionId);
      output(session, (s) => `[ok] session '${s.sessionId}' tracked [${s.lastActiveAt}]`);
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('session-track', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
