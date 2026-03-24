/**
 * MCP Bridge adapter for SearchPort.
 * Example: connects to an MCP search server and bridges its tools to SearchPort methods.
 */

import { createMcpPortAdapter, extractJson } from '../../../sdk/bridge-adapter.ts';
import type { BridgeMapping } from '../../../sdk/bridge-adapter.ts';
import type { AdapterContext, AdapterFactory } from '../../../types.ts';
import type { SearchPort, SessionSearchResult } from '../../../../search/port.ts';

const SEARCH_MAPPINGS: BridgeMapping[] = [
  {
    mcpTool: 'search_sessions',
    portMethod: 'searchSessions',
    transform: (result) => extractJson<SessionSearchResult[]>(result),
    args: (query: unknown, opts?: unknown) => ({
      query: query as string,
      ...(opts as Record<string, unknown> ?? {}),
    }),
  },
  {
    mcpTool: 'find_related',
    portMethod: 'findRelatedSessions',
    transform: (result) => extractJson<SessionSearchResult[]>(result),
    args: (filePath: unknown, limit?: unknown) => ({
      filePath: filePath as string,
      limit: (limit as number) ?? 5,
    }),
  },
];

export const createAdapter: AdapterFactory<SearchPort> = (ctx: AdapterContext) => {
  return createMcpPortAdapter<SearchPort>(ctx, SEARCH_MAPPINGS);
};
