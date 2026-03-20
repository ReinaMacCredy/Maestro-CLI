/**
 * DCP (Dynamic Context Pruning) usecase.
 * Assembles task-aware, budget-conscious context injection for worker agents.
 */

import { DEFAULT_HIVE_CONFIG, type MemoryFileWithMeta, type TaskInfo, type HiveConfig } from '../types.ts';
import { selectMemories } from '../utils/context-selector.ts';

export interface PruneContextParams {
  featureName: string;
  taskFolder: string;
  task: TaskInfo;
  spec: string;
  memories: MemoryFileWithMeta[];
  completedTasks: Array<{ name: string; summary: string }>;
  richContext: string;
  graphContext: string;
  workerRules: string;
  dcpConfig?: HiveConfig['dcp'];
  featureCreatedAt?: string;
}

export interface PruneContextResult {
  injection: string;
  metrics: {
    totalBytes: number;
    sections: { spec: number; memories: number; completed: number; rich: number; graph: number; rules: number };
    memoriesIncluded: number;
    memoriesDropped: number;
    memoriesTotal: number;
    scores: Array<{ name: string; score: number; included: boolean }>;
  };
}

const LEGACY_MEMORY_CAP = 4096;

/**
 * Build context injection with DCP scoring or legacy passthrough.
 */
export function pruneContext(params: PruneContextParams): PruneContextResult {
  const {
    taskFolder, task, spec, memories, completedTasks,
    richContext, graphContext, workerRules, dcpConfig, featureCreatedAt,
  } = params;

  // Apply config defaults from single source of truth (assertion safe: DEFAULT provides all fields)
  const cfg = { ...DEFAULT_HIVE_CONFIG.dcp, ...dcpConfig } as Required<NonNullable<HiveConfig['dcp']>>;

  // -- Memory selection --
  let memorySection: string;
  let memoriesIncluded: number;
  let memoriesDropped: number;
  let memoryBytes: number;
  let scores: Array<{ name: string; score: number; included: boolean }>;

  if (!cfg.enabled) {
    // Legacy passthrough: all memories, byte-truncated at 4KB
    memorySection = memories.length > 0
      ? '\n## Feature Memories\n\n' + memories.map(m => `### ${m.name}\n\n${m.content}`).join('\n\n---\n\n')
      : '';
    if (memorySection.length > LEGACY_MEMORY_CAP) {
      const truncated = memorySection.slice(0, LEGACY_MEMORY_CAP);
      const lastNewline = truncated.lastIndexOf('\n');
      memorySection = (lastNewline > 0 ? truncated.slice(0, lastNewline) : truncated)
        + '\n\n[truncated -- use maestro_memory_read for full content]';
    }
    memoriesIncluded = memories.length;
    memoriesDropped = 0;
    memoryBytes = Buffer.byteLength(memorySection);
    scores = memories.map(m => ({ name: m.name, score: 0, included: true }));
  } else {
    // DCP: score and select
    const planSection = task.planTitle ?? null;
    const selected = selectMemories(
      memories, task, planSection,
      cfg.memoryBudgetBytes, cfg.relevanceThreshold,
      featureCreatedAt,
    );

    memorySection = selected.memories.length > 0
      ? '\n## Feature Memories (DCP-selected)\n\n' + selected.memories.map(m => `### ${m.name}\n\n${m.bodyContent}`).join('\n\n---\n\n')
      : '';
    memoriesIncluded = selected.includedCount;
    memoriesDropped = selected.droppedCount;
    memoryBytes = selected.totalBytes;
    scores = selected.scores;
  }

  // -- Completed tasks (observation masking) --
  let completedSection = '';
  let completedBytes = 0;
  if (completedTasks.length > 0 && cfg.observationMasking) {
    // Keep newest first, drop oldest when over budget
    const items = [...completedTasks].reverse();
    const parts: string[] = [];
    let used = 0;
    for (const ct of items) {
      const line = `- ${ct.name}: ${ct.summary}`;
      const lineBytes = Buffer.byteLength(line);
      if (used + lineBytes > cfg.completedTaskBudgetBytes) break;
      parts.push(line);
      used += lineBytes;
    }
    if (parts.length > 0) {
      completedSection = '\n## Completed Tasks\n\n' + parts.join('\n');
      completedBytes = Buffer.byteLength(completedSection);
    }
  }

  // -- Assemble injection --
  const injection = [
    `## Task Spec: ${taskFolder}`,
    '',
    spec,
    richContext,
    workerRules,
    graphContext,
    completedSection,
    memorySection,
  ].join('\n');

  const specBytes = Buffer.byteLength(spec);
  const richBytes = Buffer.byteLength(richContext);
  const graphBytes = Buffer.byteLength(graphContext);
  const rulesBytes = Buffer.byteLength(workerRules);

  return {
    injection,
    metrics: {
      totalBytes: Buffer.byteLength(injection),
      sections: {
        spec: specBytes,
        memories: memoryBytes,
        completed: completedBytes,
        rich: richBytes,
        graph: graphBytes,
        rules: rulesBytes,
      },
      memoriesIncluded,
      memoriesDropped,
      memoriesTotal: memories.length,
      scores,
    },
  };
}
