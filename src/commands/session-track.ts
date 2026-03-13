/**
 * maestro session-track -- track a session for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { resolveFeature } from '../lib/resolve-feature.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'session-track', description: 'Track a session' },
  args: {
    sessionId: {
      type: 'string',
      description: 'Session ID',
      required: true,
    },
    feature: {
      type: 'string',
      description: 'Feature name (auto-resolved if omitted)',
    },
  },
  async run({ args }) {
    try {
      const feature = resolveFeature(args.feature);
      const { sessionAdapter } = getServices();
      const session = sessionAdapter.track(feature, args.sessionId);
      output(session, (s) => `[ok] session '${s.sessionId}' tracked [${s.lastActiveAt}]`);
    } catch (err) {
      handleCommandError('session-track', err);
    }
  },
});
