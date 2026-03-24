/**
 * MCP tools for session history search via CASS.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from '../services-thunk.ts';
import { respond, withErrorHandling } from '../respond.ts';
import { ANNOTATIONS_READONLY } from '../annotations.ts';
import { limitParam } from '../params.ts';
import { requireSearchPort as requireSearchPortShared } from '../../core/resolve.ts';

function requireSearchPort(thunk: ServicesThunk) {
  return requireSearchPortShared(thunk.get());
}

export function registerSearchTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_search_sessions',
    {
      description: 'Search past agent session history via CASS.',
      inputSchema: {
        query: z.string().describe('Search query'),
        agent: z.string().optional().describe('Filter to specific agent (claude, codex, cursor, etc.)'),
        limit: limitParam(10),
        days: z.number().optional().describe('Limit to recent N days'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const port = requireSearchPort(thunk);
      const results = await port.searchSessions(input.query, {
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
        limit: limitParam(5),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const port = requireSearchPort(thunk);
      const results = await port.findRelatedSessions(input.file_path, input.limit);
      return respond({ results });
    }),
  );
}
