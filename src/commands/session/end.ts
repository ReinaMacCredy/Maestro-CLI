/**
 * maestro session-end -- end (remove) a session.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output } from '../../lib/output.ts';
import { resolveFeature } from '../../utils/resolve-feature.ts';
import { MaestroError, handleCommandError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'session-end', description: 'End a session' },
  args: {
    id: {
      type: 'string',
      description: 'Session ID to end',
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
      const removed = sessionAdapter.remove(feature, args.id);
      if (!removed) {
        throw new MaestroError(`session '${args.id}' not found in feature '${feature}'`, [
          'List sessions: maestro session-list --feature <name>',
        ]);
      }
      output({ id: args.id, feature }, (r) => `[ok] session '${r.id}' ended`);
    } catch (err) {
      handleCommandError('session-end', err);
    }
  },
});
