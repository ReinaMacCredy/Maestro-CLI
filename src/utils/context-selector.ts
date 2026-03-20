/**
 * Budget-aware memory selection for DCP.
 * Greedily fills budget with highest-scoring memories.
 */

import type { MemoryFileWithMeta, TaskInfo } from '../types.ts';
import { scoreRelevance, buildTaskContext } from './relevance.ts';

export interface SelectedContext {
  memories: MemoryFileWithMeta[];  // ordered by score desc, within budget
  totalBytes: number;
  includedCount: number;
  droppedCount: number;
  scores: Array<{ name: string; score: number; included: boolean }>;
}

/**
 * Select the most relevant memories within a byte budget.
 *
 * - Scores each memory with scoreRelevance()
 * - Filters by relevanceThreshold (but always keeps top-1)
 * - Greedily fills budget in score order
 */
export function selectMemories(
  memories: MemoryFileWithMeta[],
  task: TaskInfo,
  planSection: string | null,
  budgetBytes: number,
  relevanceThreshold: number = 0.1,
  featureCreatedAt?: string,
): SelectedContext {
  if (memories.length === 0) {
    return { memories: [], totalBytes: 0, includedCount: 0, droppedCount: 0, scores: [] };
  }

  // Pre-compute task context once for all memories
  const taskCtx = buildTaskContext(task, planSection);

  if (budgetBytes <= 0) {
    const scores = memories.map(m => ({
      name: m.name,
      score: scoreRelevance(m, task, planSection, featureCreatedAt, taskCtx),
      included: false,
    }));
    return { memories: [], totalBytes: 0, includedCount: 0, droppedCount: memories.length, scores };
  }

  // Score all memories
  const scored = memories.map(m => ({
    memory: m,
    score: scoreRelevance(m, task, planSection, featureCreatedAt, taskCtx),
    bodyBytes: Buffer.byteLength(m.bodyContent),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Filter by threshold but always keep top-1
  const eligible = scored.filter((s, i) => i === 0 || s.score >= relevanceThreshold);

  // Greedily fill budget
  const included: typeof scored = [];
  let usedBytes = 0;

  for (const entry of eligible) {
    if (usedBytes + entry.bodyBytes <= budgetBytes) {
      included.push(entry);
      usedBytes += entry.bodyBytes;
    }
  }

  const scores = scored.map(s => ({
    name: s.memory.name,
    score: s.score,
    included: included.some(i => i.memory.name === s.memory.name),
  }));

  return {
    memories: included.map(i => i.memory),
    totalBytes: usedBytes,
    includedCount: included.length,
    droppedCount: memories.length - included.length,
    scores,
  };
}
