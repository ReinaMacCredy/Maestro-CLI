/**
 * MCP tool for DCP (Dynamic Context Pruning).
 * Preview, stats, and config for memory selection.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from '../services-thunk.ts';
import { respond, withErrorHandling } from '../respond.ts';
import { ANNOTATIONS_READONLY } from '../annotations.ts';
import { requireFeature } from './_resolve.ts';
import { featureParam, taskParam } from '../params.ts';
import { pruneContext } from '../../dcp/prune-context.ts';
import { resolveDcpConfig } from '../../dcp/config.ts';
import { WORKER_RULES } from '../../tasks/worker-rules.ts';
import { collectMetrics, formatMetricsSummary } from '../../dcp/metrics.ts';
import { COMPONENT_REGISTRY } from '../../dcp/components.ts';
import { DEFAULT_SETTINGS } from '../../core/settings.ts';

export function registerDcpTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_dcp',
    {
      description:
        'DCP (Dynamic Context Pruning) operations. Actions: preview (memory selection scores for a task), ' +
        'stats (token budgets and component breakdown), config (current DCP settings and component registry).',
      inputSchema: {
        action: z.enum(['preview', 'stats', 'config']).describe('Action to perform'),
        feature: featureParam(),
        task: taskParam().optional() as ReturnType<typeof z.string>,
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();

      switch (input.action) {
        case 'preview': {
          if (!input.task) return respond({ error: 'task is required for action: preview' });
          const feature = requireFeature(services, input.feature);
          const task = await services.taskPort.get(feature, input.task);
          if (!task) {
            return respond({ error: `Task '${input.task}' not found in feature '${feature}'` });
          }
          const spec = await services.taskPort.readSpec(feature, input.task) ?? '(no spec)';
          const memories = services.memoryAdapter.listWithMeta(feature);
          const resolvedDcp = resolveDcpConfig(services.settingsPort.get().dcp);
          const featureCreatedAt = services.featureAdapter.get(feature)?.createdAt;
          const allTasks = await services.taskPort.list(feature, { includeAll: true });
          const taskDeps = allTasks.map(t => ({ folder: t.folder, status: t.status, dependsOn: t.dependsOn }));
          const { metrics } = pruneContext({
            featureName: feature,
            taskFolder: input.task,
            task,
            spec,
            memories,
            richContext: '',
            graphContext: '',
            workerRules: WORKER_RULES,
            dcpConfig: resolvedDcp,
            featureCreatedAt,
            allTasks: taskDeps,
          });
          return respond({
            feature,
            task: input.task,
            dcp: { enabled: resolvedDcp.enabled, memoryBudgetTokens: resolvedDcp.memoryBudgetTokens },
            memories: { total: metrics.memoriesTotal, included: metrics.memoriesIncluded, dropped: metrics.memoriesDropped },
            scores: metrics.scores.map(s => ({
              name: s.name,
              score: Math.round(s.score * 1000) / 1000,
              included: s.included,
            })),
            sections: metrics.sections,
          });
        }
        case 'stats': {
          if (!input.task) return respond({ error: 'task is required for action: stats' });
          const feature = requireFeature(services, input.feature);
          const task = await services.taskPort.get(feature, input.task);
          if (!task) return respond({ error: `Task '${input.task}' not found` });
          const spec = await services.taskPort.readSpec(feature, input.task) ?? '';
          const memories = services.memoryAdapter.listWithMeta(feature);
          const resolvedDcp = resolveDcpConfig(services.settingsPort.get().dcp);
          const allTasks = await services.taskPort.list(feature, { includeAll: true });
          const taskDeps = allTasks.map(t => ({ folder: t.folder, id: t.id, status: t.status, dependsOn: t.dependsOn }));
          const result = pruneContext({
            featureName: feature,
            taskFolder: input.task,
            task,
            spec,
            memories,
            richContext: '',
            graphContext: '',
            workerRules: WORKER_RULES,
            dcpConfig: resolvedDcp,
            allTasks: taskDeps,
          });
          const metrics = collectMetrics(result, memories);
          return respond({ feature, task: input.task, metrics, summary: formatMetricsSummary(metrics) });
        }
        case 'config': {
          const dcpSettings = services.settingsPort.get().dcp;
          const resolved = resolveDcpConfig(dcpSettings);
          return respond({
            settings: resolved,
            components: COMPONENT_REGISTRY.map(c => ({
              name: c.name,
              priority: c.priority,
              protected: c.protected,
            })),
            defaults: DEFAULT_SETTINGS.dcp,
          });
        }
        default:
          return respond({ error: `Unknown action: ${(input as { action: string }).action}` });
      }
    }),
  );
}
