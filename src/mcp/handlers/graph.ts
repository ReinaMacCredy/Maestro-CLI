/**
 * MCP tools for bv graph intelligence.
 * Exposes dependency graph analysis, next-bead recommendation,
 * and parallel execution planning.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from '../services-thunk.ts';
import { respond, withErrorHandling } from '../respond.ts';
import { ANNOTATIONS_READONLY } from '../annotations.ts';
import { requireGraphPort as requireGraphPortShared } from '../../core/resolve.ts';

function requireGraphPort(thunk: ServicesThunk) {
  return requireGraphPortShared(thunk.get());
}

export function registerGraphTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_graph_insights',
    {
      description: 'Get dependency graph intelligence: bottlenecks, critical path, velocity. Requires bv.',
      inputSchema: {},
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async () => {
      const port = requireGraphPort(thunk);
      const insights = await port.getInsights();
      return respond({ ...insights });
    }),
  );

  server.registerTool(
    'maestro_graph_next',
    {
      description: 'Get the top recommended next bead from bv with scoring rationale.',
      inputSchema: {},
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async () => {
      const port = requireGraphPort(thunk);
      const recommendation = await port.getNextRecommendation();
      if (!recommendation) {
        return respond({ message: 'No recommendations available (all beads may be closed)' });
      }
      return respond({ ...recommendation });
    }),
  );

  server.registerTool(
    'maestro_graph_plan',
    {
      description: 'Get dependency-respecting parallel execution tracks for N agents.',
      inputSchema: {
        agents: z.number().optional().default(1).describe('Number of parallel agents (default: 1)'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const port = requireGraphPort(thunk);
      const plan = await port.getExecutionPlan(input.agents);
      return respond({ ...plan });
    }),
  );
}
