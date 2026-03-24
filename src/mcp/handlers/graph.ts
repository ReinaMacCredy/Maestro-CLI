/**
 * MCP tools for bv graph intelligence.
 * Exposes dependency graph analysis, next-bead recommendation,
 * and parallel execution planning.
 * Also exposes parallel task discovery and batch reservation tools.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from '../services-thunk.ts';
import { respond, withErrorHandling } from '../respond.ts';
import { ANNOTATIONS_READONLY, ANNOTATIONS_MUTATING } from '../annotations.ts';
import { requireGraphPort as requireGraphPortShared, requireFeature } from '../../core/resolve.ts';
import { featureParam } from '../params.ts';

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

  server.registerTool(
    'maestro_discovery',
    {
      description:
        'Parallel discovery: get all runnable tasks with their specs for parallel dispatch planning.',
      inputSchema: {
        feature: featureParam(),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);
      const runnable = await services.taskPort.getRunnable(feature);

      const tasks = await Promise.all(
        runnable.map(async (task) => {
          const spec = await services.taskPort.readSpec(feature, task.id);
          return { id: task.id, name: task.name, status: task.status, dependsOn: task.dependsOn, spec };
        }),
      );

      return respond({ feature, count: tasks.length, tasks });
    }),
  );

  server.registerTool(
    'maestro_reserve',
    {
      description:
        'Batch claim: atomically claim multiple tasks for parallel agents. Best-effort -- failures are reported but do not abort.',
      inputSchema: {
        feature: featureParam(),
        tasks: z.array(z.string()).describe('Task IDs to claim'),
      },
      annotations: ANNOTATIONS_MUTATING,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);

      const claimed: string[] = [];
      const failed: Array<{ id: string; reason: string }> = [];

      for (const taskId of input.tasks) {
        try {
          await services.taskPort.claim(feature, taskId, 'parallel-agent');
          claimed.push(taskId);
        } catch (err) {
          failed.push({ id: taskId, reason: err instanceof Error ? err.message : String(err) });
        }
      }

      return respond({ feature, claimed, failed });
    }),
  );
}
