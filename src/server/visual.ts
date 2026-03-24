import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_MUTATING } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { featureParam } from './_utils/params.ts';
import { visualize } from '../visual/visualize.ts';
import { debugVisualize } from '../visual/debug-visualize.ts';

export function registerVisualTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_visual',
    {
      description:
        'Render maestro state as an interactive HTML visualization. Writes to ~/.maestro/visuals/. ' +
        'Types: plan-graph (task dependency flowchart), status-dashboard (KPI cards + progress), ' +
        'memory-map (category grid + distribution), execution-timeline (task events + knowledge flow), ' +
        'doctrine-network (doctrine relationships + effectiveness).',
      inputSchema: {
        type: z.enum(['plan-graph', 'status-dashboard', 'memory-map', 'execution-timeline', 'doctrine-network'])
          .describe('Visualization type'),
        feature: featureParam(),
        autoOpen: z.boolean().optional().default(true).describe('Open browser automatically'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const result = await visualize(input.type, feature, services, input.autoOpen);
      return respond({
        path: result.path,
        opened: result.opened,
        type: result.type,
        feature: result.feature,
      });
    }),
  );

  server.registerTool(
    'maestro_debug_visual',
    {
      description:
        'Render debug data as an interactive HTML visualization. Writes to ~/.maestro/visuals/. ' +
        'Agent provides structured data matching the type schema. ' +
        'Types: component-tree (React/Vue hierarchy), state-flow (mutation timeline), ' +
        'error-cascade (error boundary tree), network-waterfall (request timing), ' +
        'dom-diff (expected vs actual), console-timeline (log entries).',
      inputSchema: {
        type: z.enum(['component-tree', 'state-flow', 'error-cascade', 'network-waterfall', 'dom-diff', 'console-timeline'])
          .describe('Debug visualization type'),
        data: z.record(z.unknown()).describe('Structured data matching the type schema'),
        title: z.string().optional().describe('Page title (defaults to type name)'),
        autoOpen: z.boolean().optional().default(true).describe('Open browser automatically'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const result = await debugVisualize(input.type, input.data, input.title, input.autoOpen);
      return respond({
        path: result.path,
        opened: result.opened,
        type: result.type,
      });
    }),
  );
}
