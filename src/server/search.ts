/**
 * MCP tools for session history search via CASS.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY } from './_utils/annotations.ts';
import { MaestroError } from '../lib/errors.ts';

export function registerSearchTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_search_sessions',
    {
      description: 'Search past agent session history via CASS.',
      inputSchema: {
        query: z.string().describe('Search query'),
        agent: z.string().optional().describe('Filter to specific agent (claude, codex, cursor, etc.)'),
        limit: z.number().optional().default(10).describe('Max results (default: 10)'),
        days: z.number().optional().describe('Limit to recent N days'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      if (!services.searchPort) {
        throw new MaestroError('CASS not available', ['Install cass: https://github.com/Dicklesworthstone/coding_agent_session_search']);
      }
      const results = await services.searchPort.searchSessions(input.query, {
        agent: input.agent,
        limit: input.limit,
        days: input.days,
      });
      return respond({ results });
    }),
  );

  server.registerTool(
    'maestro_search_related',
    {
      description:
        'Find past agent sessions that worked on a specific file.',
      inputSchema: {
        file_path: z.string().describe('File path to search for'),
        limit: z.number().optional().default(5).describe('Max results (default: 5)'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      if (!services.searchPort) {
        throw new MaestroError('CASS not available', ['Install cass: https://github.com/Dicklesworthstone/coding_agent_session_search']);
      }
      const results = await services.searchPort.findRelatedSessions(input.file_path, input.limit);
      return respond({ results });
    }),
  );
}
