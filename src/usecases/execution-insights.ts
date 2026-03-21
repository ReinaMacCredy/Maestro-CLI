/**
 * Query the execution knowledge graph for a feature.
 * Lists execution memories, computes downstream edges, and calculates coverage.
 */

import type { TaskPort } from '../ports/tasks.ts';
import type { MemoryPort } from '../ports/memory.ts';
import type { DoctrinePort } from '../ports/doctrine.ts';
import { buildDownstreamMap, extractSourceTask, scoreDependencyProximity } from '../utils/dependency-proximity.ts';
import type { TaskWithDeps } from '../utils/task-dependency-graph.ts';
import { isExecutionMemory } from '../utils/execution-memory.ts';
import { parseExecMemory } from '../utils/parse-exec-memory.ts';
import { resolveDoctrineConfig } from '../utils/doctrine-config.ts';

export interface ExecutionInsight {
  sourceTask: string;
  summary: string;
  filesChanged: number;
  verificationPassed: boolean;
  tags: string[];
  downstreamTasks: string[];
}

export interface DoctrineEffectivenessInsight {
  name: string;
  injectionCount: number;
  successRate: number;
  overrideCount: number;
  stale: boolean;
}

export interface ExecutionInsightsResult {
  feature: string;
  insights: ExecutionInsight[];
  coverage: {
    totalTasks: number;
    withExecMemory: number;
    percent: number;
  };
  knowledgeFlow: Array<{ from: string; to: string; proximity: number }>;
  doctrineEffectiveness?: DoctrineEffectivenessInsight[];
}

export async function executionInsights(
  featureName: string,
  taskPort: TaskPort,
  memoryAdapter: MemoryPort,
  doctrinePort?: DoctrinePort,
): Promise<ExecutionInsightsResult> {
  // List all memories and filter to exec-*
  const allMemories = memoryAdapter.listWithMeta(featureName);
  const execMemories = allMemories.filter(m => isExecutionMemory(m.name));

  // List all tasks
  const allTasks = await taskPort.list(featureName, { includeAll: true });
  const taskDeps: TaskWithDeps[] = allTasks.map(t => ({
    folder: t.folder,
    status: t.status,
    dependsOn: t.dependsOn,
  }));

  // Build downstream map for knowledge flow
  const downstream = buildDownstreamMap(taskDeps);

  // Build insights for each execution memory
  const taskFolders = new Set(allTasks.map(t => t.folder));
  const execTaskFolders = new Set<string>();
  const insights: ExecutionInsight[] = [];

  for (const mem of execMemories) {
    const sourceTask = extractSourceTask(mem.name);
    if (!sourceTask || !taskFolders.has(sourceTask)) continue;

    execTaskFolders.add(sourceTask);
    const parsed = parseExecMemory(mem.content);

    // Find downstream tasks
    const downstreamTasks = downstream.get(sourceTask) ?? [];

    insights.push({
      sourceTask,
      summary: parsed.summary,
      filesChanged: parsed.filesChanged,
      verificationPassed: parsed.verificationPassed,
      tags: parsed.tags,
      downstreamTasks,
    });
  }

  // Coverage
  const totalTasks = allTasks.length;
  const withExecMemory = execTaskFolders.size;
  const percent = totalTasks > 0 ? Math.round((withExecMemory / totalTasks) * 100) : 0;

  // Knowledge flow: all edges with proximity scores
  const knowledgeFlow: Array<{ from: string; to: string; proximity: number }> = [];
  for (const sourceTask of execTaskFolders) {
    for (const target of taskFolders) {
      if (target === sourceTask) continue;
      const proximity = scoreDependencyProximity(sourceTask, target, downstream);
      if (proximity > 0) {
        knowledgeFlow.push({ from: sourceTask, to: target, proximity });
      }
    }
  }

  // Sort flow by proximity descending
  knowledgeFlow.sort((a, b) => b.proximity - a.proximity);

  // Doctrine effectiveness (Phase 4)
  let doctrineEffectiveness: DoctrineEffectivenessInsight[] | undefined;
  if (doctrinePort) {
    try {
      const cfg = resolveDoctrineConfig();
      const now = Date.now();
      const staleMs = cfg.staleThresholdDays * 24 * 60 * 60 * 1000;
      const activeItems = doctrinePort.list({ status: 'active' });

      doctrineEffectiveness = activeItems.map(item => {
        const lastInjected = item.effectiveness.lastInjectedAt
          ? new Date(item.effectiveness.lastInjectedAt).getTime()
          : 0;
        const neverInjected = item.effectiveness.injectionCount === 0;
        const created = new Date(item.createdAt).getTime();
        const stale = neverInjected
          ? (now - created > 30 * 24 * 60 * 60 * 1000) // 30 days for never-injected
          : (now - lastInjected > staleMs);

        return {
          name: item.name,
          injectionCount: item.effectiveness.injectionCount,
          successRate: item.effectiveness.associatedSuccessRate,
          overrideCount: item.effectiveness.overrideCount,
          stale,
        };
      });
    } catch {
      // Best-effort
    }
  }

  return {
    feature: featureName,
    insights,
    coverage: { totalTasks, withExecMemory, percent },
    knowledgeFlow,
    doctrineEffectiveness,
  };
}
