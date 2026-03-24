/**
 * DCP (Dynamic Context Pruning) usecase.
 * Assembles task-aware, budget-conscious context injection for worker agents.
 */

import { type MemoryFileWithMeta, type TaskInfo, type HiveConfig } from '../core/types.ts';
import type { TaskWithDeps } from '../tasks/graph/dependency.ts';
import type { DoctrineItem } from '../doctrine/port.ts';
import { selectMemories } from './selector.ts';
import { isExecutionMemory } from '../memory/execution/writer.ts';
import { resolveDcpConfig } from './config.ts';
import { resolveDoctrineConfig } from '../doctrine/config.ts';
import { estimateTokens } from '../core/tokens.ts';

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
  doctrineConfig?: HiveConfig['doctrine'];
  doctrineItems?: DoctrineItem[];
  featureCreatedAt?: string;
  allTasks?: TaskWithDeps[];
}

export interface PruneContextResult {
  injection: string;
  metrics: {
    totalBytes: number;
    totalTokens: number;
    sections: { spec: number; memories: number; completed: number; rich: number; graph: number; rules: number; doctrine: number };
    memoriesIncluded: number;
    memoriesDropped: number;
    memoriesTotal: number;
    executionMemoriesIncluded: number;
    doctrineItemsIncluded: number;
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
    dcpConfig, doctrineConfig, doctrineItems = [], featureCreatedAt, allTasks,
  } = params;

  const cfg = resolveDcpConfig(dcpConfig);
  const doctrineCfg = resolveDoctrineConfig(doctrineConfig);

  // -- Memory selection --
  let memorySection: string;
  let memoriesIncluded: number;
  let memoriesDropped: number;
  let memoryBytes: number;
  let executionMemoriesIncluded: number;
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
    executionMemoriesIncluded = 0;
    memoryBytes = Buffer.byteLength(memorySection);
    scores = memories.map(m => ({ name: m.name, score: 0, included: true }));
  } else {
    const planSection = task.planTitle ?? null;
    const selected = selectMemories(
      memories, task, planSection,
      cfg.memoryBudgetTokens, cfg.relevanceThreshold,
      featureCreatedAt, allTasks,
    );

    const execMemories = selected.memories.filter(m => isExecutionMemory(m.name));
    const userMemories = selected.memories.filter(m => !isExecutionMemory(m.name));

    const execSection = execMemories.length > 0
      ? '\n## Upstream Context (from completed tasks)\n\n' + execMemories.map(m => `### ${m.name}\n\n${m.bodyContent}`).join('\n\n---\n\n')
      : '';
    const userSection = userMemories.length > 0
      ? '\n## Feature Memories (DCP-selected)\n\n' + userMemories.map(m => `### ${m.name}\n\n${m.bodyContent}`).join('\n\n---\n\n')
      : '';
    memorySection = execSection + userSection;

    memoriesIncluded = selected.includedCount;
    memoriesDropped = selected.droppedCount;
    executionMemoriesIncluded = execMemories.length;
    memoryBytes = Buffer.byteLength(memorySection);
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
        const lineTokens = estimateTokens(line);
        if (used + lineTokens > cfg.completedTaskBudgetTokens) break;
        parts.push(line);
        used += lineTokens;
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

  // -- Doctrine section (separate budget from memories) --
  let doctrineSection = '';
  let doctrineBytes = 0;
  let doctrineItemsIncluded = 0;

  if (doctrineCfg.enabled && doctrineItems.length > 0) {
    const parts: string[] = [];
    let used = 0;
    for (const item of doctrineItems) {
      const block = `### ${item.name}\n**Rule**: ${item.rule}\n**Rationale**: ${item.rationale}`;
      const blockTokens = estimateTokens(block);
      if (used + blockTokens > doctrineCfg.doctrineBudgetTokens) break;
      parts.push(block);
      used += blockTokens;
      doctrineItemsIncluded++;
    }
    if (parts.length > 0) {
      doctrineSection = '\n## Applicable Doctrine\n\n' + parts.join('\n\n---\n\n');
      doctrineBytes = Buffer.byteLength(doctrineSection);
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
    doctrineSection,
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
      totalTokens: estimateTokens(injection),
      sections: {
        spec: specBytes,
        memories: memoryBytes,
        completed: completedBytes,
        rich: richBytes,
        graph: graphBytes,
        rules: rulesBytes,
        doctrine: doctrineBytes,
      },
      memoriesIncluded,
      memoriesDropped,
      memoriesTotal: memories.length,
      executionMemoriesIncluded,
      doctrineItemsIncluded,
      scores,
    },
  };
}
