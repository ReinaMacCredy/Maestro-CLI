/**
 * maestro session-track -- track a session for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { handleCommandError } from '../lib/errors.ts';

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
      handleCommandError('session-track', err);
    }
  },
});
