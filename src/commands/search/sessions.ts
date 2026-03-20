/**
 * maestro search-sessions -- search past agent sessions.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output, renderTable } from '../../lib/output.ts';
import { handleCommandError, MaestroError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'search-sessions', description: 'Search past agent sessions' },
  args: {
    query: {
      type: 'string',
      description: 'Search query',
      required: true,
    },
    agent: {
      type: 'string',
      description: 'Filter by agent name',
    },
    limit: {
      type: 'string',
      description: 'Max results (default: 10)',
    },
    days: {
      type: 'string',
      description: 'Limit to sessions within N days',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      if (!services.searchPort) {
        throw new MaestroError('CASS not available', ['Install cass: https://github.com/Dicklesworthstone/coding_agent_session_search']);
      }

      const results = await services.searchPort.searchSessions(args.query, {
        agent: args.agent,
        limit: args.limit ? parseInt(args.limit, 10) : undefined,
        days: args.days ? parseInt(args.days, 10) : undefined,
      });

      output({ results }, () => {
        if (results.length === 0) return 'No sessions found.';
        return renderTable(
          ['Session', 'Agent', 'Match', 'Score'],
          results.map((r) => [r.sessionPath, r.agent, r.matchLine, String(r.score)]),
        );
      });
    } catch (err) {
      handleCommandError('search-sessions', err);
    }
  },
});
