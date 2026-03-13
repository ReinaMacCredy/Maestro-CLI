/**
 * maestro session-master -- set the master session for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { resolveFeature } from '../lib/resolve-feature.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'session-master', description: 'Set master session' },
  args: {
    sessionId: {
      type: 'string',
      description: 'Session ID to set as master',
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
      sessionAdapter.setMaster(feature, args.sessionId);
      output({ feature: args.feature, master: args.sessionId }, () =>
        `[ok] master session set to '${args.sessionId}'`
      );
    } catch (err) {
      handleCommandError('session-master', err);
    }
  },
});
