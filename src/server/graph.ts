/**
 * MCP tools for bv graph intelligence.
 * Exposes dependency graph analysis, next-bead recommendation,
 * and parallel execution planning.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY } from './_utils/annotations.ts';
import { MaestroError } from '../lib/errors.ts';

export function registerGraphTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_graph_insights',
    {
      description:
        'Get dependency graph intelligence: bottlenecks, critical path, velocity metrics. ' +
        'Requires bv (beads viewer) to be installed.',
      inputSchema: {},
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async () => {
      const services = thunk.get();
      if (!services.graphPort) {
        throw new MaestroError('bv not available', ['Install bv (beads viewer) for graph intelligence']);
      }
      const insights = await services.graphPort.getInsights();
      return respond({ success: true, ...insights });
    }),
  );

  server.registerTool(
    'maestro_graph_next',
    {
      description:
        'Get the top recommended next bead from bv with scoring rationale. ' +
        'Uses PageRank, betweenness, and priority to recommend the highest-impact task.',
      inputSchema: {},
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async () => {
      const services = thunk.get();
      if (!services.graphPort) {
        throw new MaestroError('bv not available', ['Install bv (beads viewer) for graph intelligence']);
      }
      const recommendation = await services.graphPort.getNextRecommendation();
      if (!recommendation) {
        return respond({ success: true, message: 'No recommendations available (all beads may be closed)' });
      }
      return respond({ success: true, ...recommendation });
    }),
  );

  server.registerTool(
    'maestro_graph_plan',
    {
      description:
        'Get dependency-respecting parallel execution tracks for N agents. ' +
        'Returns ordered tracks that can be worked in parallel without conflicts.',
      inputSchema: {
        agents: z.number().optional().default(1).describe('Number of parallel agents (default: 1)'),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      if (!services.graphPort) {
        throw new MaestroError('bv not available', ['Install bv (beads viewer) for graph intelligence']);
      }
      const plan = await services.graphPort.getExecutionPlan(input.agents);
      return respond({ success: true, ...plan });
    }),
  );
}
