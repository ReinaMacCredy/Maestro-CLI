/**
 * maestro session-fresh -- create a fresh session for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { resolveFeature } from '../../utils/resolve-feature.ts';
import { handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'session-fresh', description: 'Create a fresh session' },
  args: {
    title: {
      type: 'string',
      description: 'Optional session title',
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
      const session = sessionAdapter.fresh(feature, args.title);
      output(session, (s) => `[ok] fresh session '${s.sessionId}' created`);
    } catch (err) {
      handleCommandError('session-fresh', err);
    }
  },
});
