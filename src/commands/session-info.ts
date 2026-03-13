/**
 * maestro session-info -- show details for a specific session.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { resolveFeature } from '../lib/resolve-feature.ts';
import { formatError, handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'session-info', description: 'Show session details' },
  args: {
    id: {
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
      const session = sessionAdapter.get(feature, args.id);
      if (!session) {
        console.error(formatError('session-info', `session '${args.id}' not found in feature '${feature}'`));
        process.exit(1);
      }
      const master = sessionAdapter.getMaster(feature);
      output({ ...session, isMaster: master === session.sessionId }, (s) => {
        const lines = [
          `session: ${s.sessionId}${s.isMaster ? ' [master]' : ''}`,
          `task: ${s.taskFolder ?? '-'}`,
          `started: ${s.startedAt}`,
          `last active: ${s.lastActiveAt}`,
        ];
        if (s.messageCount !== undefined) {
          lines.push(`messages: ${s.messageCount}`);
        }
        return lines.join('\n');
      });
    } catch (err) {
      handleCommandError('session-info', err);
    }
  },
});
