/**
 * maestro session-list -- list sessions for a feature.
 */

import { defineCommand } from 'citty';
import { getServices } from '../services.ts';
import { output, renderTable } from '../lib/output.ts';
import { resolveFeature } from '../utils/resolve-feature.ts';
import { handleCommandError } from '../lib/errors.ts';

export default defineCommand({
  meta: { name: 'session-list', description: 'List sessions' },
  args: {
    feature: {
      type: 'string',
      description: 'Feature name (auto-resolved if omitted)',
    },
  },
  async run({ args }) {
    try {
      const feature = resolveFeature(args.feature);
      const { sessionAdapter } = getServices();
      const sessions = sessionAdapter.list(feature);
      output(sessions, (items) => {
        if (items.length === 0) return 'No sessions found.';
        const rows = items.map((s: { sessionId: string; taskFolder?: string; lastActiveAt: string }) => [
          s.sessionId,
          s.taskFolder ?? '-',
          s.lastActiveAt,
        ]);
        return renderTable(['Session ID', 'Task Folder', 'Last Active'], rows);
      });
    } catch (err) {
      handleCommandError('session-list', err);
    }
  },
});
