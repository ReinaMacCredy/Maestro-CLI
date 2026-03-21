/**
 * Query the execution knowledge graph for a feature.
 * Lists execution memories, computes downstream edges, and calculates coverage.
 */

import type { TaskPort } from '../ports/tasks.ts';
import type { MemoryPort } from '../ports/memory.ts';
import { buildDownstreamMap, extractSourceTask, scoreDependencyProximity } from '../utils/dependency-proximity.ts';
import type { TaskWithDeps } from '../utils/task-dependency-graph.ts';
import { parseFrontmatterRich } from '../utils/frontmatter.ts';
import { stripFrontmatter } from '../utils/frontmatter.ts';

export interface ExecutionInsight {
  sourceTask: string;
  summary: string;
  filesChanged: number;
  verificationPassed: boolean;
  tags: string[];
  downstreamTasks: string[];
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
}

/** Parse structured fields from execution memory body. */
function parseExecMemory(content: string): {
  summary: string;
  filesChanged: number;
  verificationPassed: boolean;
  tags: string[];
} {
  const meta = parseFrontmatterRich(content);
  const body = stripFrontmatter(content);

  // Extract summary
  const summaryMatch = body.match(/\*\*Summary\*\*:\s*(.+)/);
  const summary = summaryMatch?.[1] ?? '';

  // Extract files changed count
  const filesMatch = body.match(/\*\*Files changed\*\*\s*\((\d+)\)/);
  const filesChanged = filesMatch ? parseInt(filesMatch[1], 10) : 0;

  // Extract verification result
  const verificationPassed = body.includes('**Verification**: passed');

  // Extract tags from frontmatter
  const rawTags = meta?.tags;
  const tags = Array.isArray(rawTags) ? rawTags as string[] : [];

  return { summary, filesChanged, verificationPassed, tags };
}

export async function executionInsights(
  featureName: string,
  taskPort: TaskPort,
  memoryAdapter: MemoryPort,
): Promise<ExecutionInsightsResult> {
  // List all memories and filter to exec-*
  const allMemories = memoryAdapter.listWithMeta(featureName);
  const execMemories = allMemories.filter(m => m.name.startsWith('exec-'));

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
      const proximity = scoreDependencyProximity(sourceTask, target, taskDeps);
      if (proximity > 0) {
        knowledgeFlow.push({ from: sourceTask, to: target, proximity });
      }
    }
  }

  // Sort flow by proximity descending
  knowledgeFlow.sort((a, b) => b.proximity - a.proximity);

  return {
    feature: featureName,
    insights,
    coverage: { totalTasks, withExecMemory, percent },
    knowledgeFlow,
  };
}
