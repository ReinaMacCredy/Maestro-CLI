/**
 * maestro search-related -- find sessions related to a file.
 */

import { defineCommand } from 'citty';
import { getServices } from '../../services.ts';
import { output, renderTable } from '../../lib/output.ts';
import { handleCommandError, MaestroError } from '../../lib/errors.ts';

export default defineCommand({
  meta: { name: 'search-related', description: 'Find sessions related to a file' },
  args: {
    file: {
      type: 'string',
      description: 'File path to search for',
      required: true,
    },
    limit: {
      type: 'string',
      description: 'Max results (default: 5)',
    },
  },
  async run({ args }) {
    try {
      const services = getServices();
      if (!services.searchPort) {
        throw new MaestroError('CASS not available', ['Install cass: https://github.com/Dicklesworthstone/coding_agent_session_search']);
      }

      const limit = args.limit ? parseInt(args.limit, 10) : undefined;
      const results = await services.searchPort.findRelatedSessions(args.file, limit);

      output({ results }, () => {
        if (results.length === 0) return 'No sessions found.';
        return renderTable(
          ['Session', 'Agent', 'Match', 'Score'],
          results.map((r) => [r.sessionPath, r.agent, r.matchLine, String(r.score)]),
        );
      });
    } catch (err) {
      handleCommandError('search-related', err);
    }
  },
});
