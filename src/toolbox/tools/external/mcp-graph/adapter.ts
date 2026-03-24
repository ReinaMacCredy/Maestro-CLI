/**
 * MCP Bridge adapter for GraphPort.
 * Example: connects to an MCP graph server and bridges its tools to GraphPort methods.
 */

import { createMcpPortAdapter, extractJson } from '../../../sdk/bridge-adapter.ts';
import type { BridgeMapping } from '../../../sdk/bridge-adapter.ts';
import type { AdapterContext, AdapterFactory } from '../../../types.ts';
import type { GraphPort, GraphInsights, NextRecommendation, ExecutionPlan } from '../../../../tasks/graph/port.ts';

const GRAPH_MAPPINGS: BridgeMapping[] = [
  {
    mcpTool: 'get_insights',
    portMethod: 'getInsights',
    transform: (result) => extractJson<GraphInsights>(result),
  },
  {
    mcpTool: 'get_next_recommendation',
    portMethod: 'getNextRecommendation',
    transform: (result) => {
      try { return extractJson<NextRecommendation>(result); }
      catch { return null; }
    },
  },
  {
    mcpTool: 'get_execution_plan',
    portMethod: 'getExecutionPlan',
    transform: (result) => extractJson<ExecutionPlan>(result),
    args: (agents?: unknown) => ({
      agents: (agents as number) ?? 1,
    }),
  },
];

export const createAdapter: AdapterFactory<GraphPort> = (ctx: AdapterContext) => {
  return createMcpPortAdapter<GraphPort>(ctx, GRAPH_MAPPINGS);
};
