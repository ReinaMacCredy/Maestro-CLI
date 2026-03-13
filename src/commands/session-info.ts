/**
 * maestro session-info -- show details for a specific session.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output } from '../lib/output.ts';
import { resolveFeature } from '../utils/resolve-feature.ts';
import { MaestroError, handleCommandError } from '../lib/errors.ts';

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
      const data = sessionAdapter.getAll(feature);
      const session = data.sessions.find(s => s.sessionId === args.id);
      if (!session) {
        throw new MaestroError(`session '${args.id}' not found in feature '${feature}'`, [
          'List sessions: maestro session-list --feature <name>',
        ]);
      }
      output({ ...session, isMaster: data.master === session.sessionId }, (s) => {
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
