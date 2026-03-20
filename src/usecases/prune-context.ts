/**
 * DCP (Dynamic Context Pruning) usecase.
 * Assembles task-aware, budget-conscious context injection for worker agents.
 */

import { type MemoryFileWithMeta, type TaskInfo, type HiveConfig } from '../types.ts';
import { selectMemories } from '../utils/context-selector.ts';
import { resolveDcpConfig } from '../utils/dcp-config.ts';

export interface PruneContextParams {
  featureName: string;
  taskFolder: string;
  task: TaskInfo;
  spec: string;
  memories: MemoryFileWithMeta[];
  completedTasks?: Array<{ name: string; summary: string }>;
  richContext: string;
  graphContext: string;
  revisionContext?: string;
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

/** Strip legacy "## Prior Work" sections baked into beads before DCP Phase 3. */
const PRIOR_WORK_RE = /\n?## Prior Work\n[\s\S]*?(?=\n##\s|\n*$)/;

/**
 * Build context injection with DCP scoring or legacy passthrough.
 */
export function pruneContext(params: PruneContextParams): PruneContextResult {
  const {
    taskFolder, task, spec, memories, completedTasks = [],
    richContext, graphContext, revisionContext = '', workerRules,
    dcpConfig, featureCreatedAt,
  } = params;

  const cfg = resolveDcpConfig(dcpConfig);

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
  if (completedTasks.length > 0) {
    if (cfg.observationMasking) {
      // Budget-capped, newest first (DCP behavior)
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
    } else {
      // No masking: include ALL completed tasks (legacy behavior)
      const parts = completedTasks.map(ct => `- ${ct.name}: ${ct.summary}`);
      completedSection = '\n## Completed Tasks\n\n' + parts.join('\n');
      completedBytes = Buffer.byteLength(completedSection);
    }
  }

  // Strip legacy "## Prior Work" from spec to prevent double injection
  // with the hook's own "## Completed Tasks" section.
  const cleanSpec = spec.replace(PRIOR_WORK_RE, '');

  // -- Assemble injection --
  const injection = [
    `## Task Spec: ${taskFolder}`,
    '',
    cleanSpec,
    richContext,
    workerRules,
    revisionContext,
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
