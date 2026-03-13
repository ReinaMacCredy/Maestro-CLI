/**
 * maestro session-fork -- fork a session from an existing one.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { resolveFeature } from '../utils/resolve-feature.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'session-fork', description: 'Fork a session' },
  args: {
    from: {
      type: 'string',
      description: 'Source session ID to fork from (defaults to master)',
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
      const session = sessionAdapter.fork(feature, args.from);
      output(session, (s) => `[ok] forked session '${s.sessionId}'`);
    } catch (err) {
      handleCommandError('session-fork', err);
    }
  },
});
