/**
 * maestro session-master -- set the master session for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { formatError, formatHint, MaestroError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'session-master', description: 'Set master session' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name',
      required: true,
    },
    sessionId: {
      type: 'string',
      description: 'Session ID to set as master',
      required: true,
    },
  },
  async run({ args }) {
    try {
      const { sessionAdapter } = getServices();
      sessionAdapter.setMaster(args.feature, args.sessionId);
      output({ feature: args.feature, master: args.sessionId }, () =>
        `[ok] master session set to '${args.sessionId}'`
      );
    } catch (err) {
      if (err instanceof MaestroError || err instanceof Error) {
        console.error(formatError('session-master', err.message));
        if (err instanceof MaestroError) err.hints.forEach(h => console.error(formatHint(h)));
        process.exit(1);
      }
      throw err;
    }
  },
});
