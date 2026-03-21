/**
 * MCP tool for DCP (Dynamic Context Pruning) preview.
 * Shows what memories would be selected for a given task.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServicesThunk } from './_utils/services-thunk.ts';
import { respond, withErrorHandling } from './_utils/respond.ts';
import { ANNOTATIONS_READONLY } from './_utils/annotations.ts';
import { requireFeature } from './_utils/resolve.ts';
import { featureParam, taskParam } from './_utils/params.ts';
import { pruneContext } from '../usecases/prune-context.ts';
import { resolveDcpConfig } from '../utils/dcp-config.ts';
import { WORKER_RULES } from '../utils/worker-rules.ts';

export function registerDcpTools(server: McpServer, thunk: ServicesThunk): void {
  server.registerTool(
    'maestro_dcp_preview',
    {
      description: 'Preview DCP memory selection for a task. Shows which memories would be included/dropped and their relevance scores.',
      inputSchema: {
        feature: featureParam(),
        task: taskParam(),
      },
      annotations: ANNOTATIONS_READONLY,
    },
    withErrorHandling(async (input) => {
      const services = thunk.get();
      const feature = requireFeature(services, input.feature);

      const task = await services.taskPort.get(feature, input.task);
      if (!task) {
        return respond({ error: `Task '${input.task}' not found in feature '${feature}'` });
      }

      const spec = await services.taskPort.readSpec(feature, input.task) ?? '(no spec)';
      const memories = services.memoryAdapter.listWithMeta(feature);
      const resolvedDcp = resolveDcpConfig(services.configAdapter.get().dcp);

      const featureInfo = services.featureAdapter.get(feature);
      const featureCreatedAt = featureInfo?.createdAt;

      // Load all tasks for dependency-proximity scoring
      const allTasks = await services.taskPort.list(feature, { includeAll: true });
      const taskDeps = allTasks.map(t => ({
        folder: t.folder, status: t.status, dependsOn: t.dependsOn,
      }));

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
        dcp: {
          enabled: resolvedDcp.enabled,
          memoryBudgetBytes: resolvedDcp.memoryBudgetBytes,
        },
        memories: {
          total: metrics.memoriesTotal,
          included: metrics.memoriesIncluded,
          dropped: metrics.memoriesDropped,
        },
        scores: metrics.scores.map(s => ({
          name: s.name,
          score: Math.round(s.score * 1000) / 1000,
          included: s.included,
        })),
        sections: metrics.sections,
      });
    }),
  );
}
