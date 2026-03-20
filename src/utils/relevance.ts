/**
 * DCP relevance scoring -- scores memories against task context.
 * Deterministic, no LLM calls. All factors normalized to 0.0-1.0.
 */

import type { MemoryFileWithMeta, TaskInfo } from '../types.ts';

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'will', 'are',
  'was', 'been', 'not', 'but', 'can', 'all', 'its', 'also', 'into', 'when',
  'then', 'than', 'each', 'such', 'only', 'some', 'just', 'more', 'most',
  'very', 'much', 'your', 'what', 'which', 'they', 'them', 'their', 'there',
  'here', 'where', 'about', 'after', 'before', 'other',
]);

const WEIGHTS = {
  tagOverlap: 0.30,
  categoryMatch: 0.20,
  priority: 0.15,
  recency: 0.10,
  keywordOverlap: 0.25,
} as const;

/**
 * Extract meaningful words from text for keyword matching.
 * Lowercase, split on whitespace/punctuation, remove stopwords, filter < 4 chars.
 */
export function extractKeywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .split(/[\s\-_,.;:!?()[\]{}"'`\/\\|#@&=+*<>]+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w));
  return new Set(words);
}

/**
 * Word-boundary tag matching.
 * Tag "auth" matches word "auth" in context, NOT substring "auth" inside "coauthored".
 */
function matchesTag(tag: string, context: string): boolean {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`, 'i');
  return re.test(context);
}

function scoreTagOverlap(
  memoryTags: string[],
  taskName: string,
  taskFolder: string,
  planSection: string | null,
): number {
  if (memoryTags.length === 0) return 0;
  const context = [taskName, taskFolder, planSection ?? ''].join(' ');
  const matching = memoryTags.filter(tag => matchesTag(tag, context));
  return matching.length / memoryTags.length;
}

function scoreCategoryMatch(
  category: string | undefined,
  task: TaskInfo,
): number {
  if (!category) return 0;
  if (category === 'architecture' || category === 'decision') return 1.0;
  if (category === 'debug') return task.status === 'blocked' ? 1.0 : 0.0;
  if (category === 'research') return 0.5;
  return 0;
}

function scorePriority(priority: number | undefined): number {
  const clamped = Math.max(0, Math.min(4, priority ?? 2));
  return (4 - clamped) / 4;
}

function scoreRecency(
  memoryUpdatedAt: string,
  featureCreatedAt: string,
): number {
  const now = Date.now();
  const mtime = new Date(memoryUpdatedAt).getTime();
  const created = new Date(featureCreatedAt).getTime();
  const featureAge = Math.max(now - created, 3600000); // floor 1 hour
  const memoryAge = now - mtime;
  return 1 - Math.max(0, Math.min(1, memoryAge / featureAge));
}

function scoreKeywordOverlap(
  bodyContent: string,
  fileName: string,
  taskName: string,
  taskFolder: string,
  planSection: string | null,
): number {
  const memoryText = bodyContent.slice(0, 500) + ' ' + fileName;
  const memoryWords = extractKeywords(memoryText);
  if (memoryWords.size === 0) return 0;

  const taskText = [taskName, taskFolder, planSection ?? ''].join(' ');
  const taskWords = extractKeywords(taskText);

  let intersection = 0;
  for (const word of memoryWords) {
    if (taskWords.has(word)) intersection++;
  }

  return intersection / memoryWords.size;
}

/**
 * Score a memory's relevance to a task. Returns 0.0-1.0.
 */
export function scoreRelevance(
  memory: MemoryFileWithMeta,
  task: TaskInfo,
  planSection: string | null,
  featureCreatedAt?: string,
): number {
  const tags = memory.metadata.tags ?? [];

  const tagScore = scoreTagOverlap(tags, task.name, task.folder, planSection);
  const categoryScore = scoreCategoryMatch(memory.metadata.category, task);
  const priorityScore = scorePriority(memory.metadata.priority);
  const recencyScore = featureCreatedAt
    ? scoreRecency(memory.updatedAt, featureCreatedAt)
    : 0.5; // default when feature creation time unknown
  const keywordScore = scoreKeywordOverlap(
    memory.bodyContent, memory.name,
    task.name, task.folder, planSection,
  );

  return (
    WEIGHTS.tagOverlap * tagScore +
    WEIGHTS.categoryMatch * categoryScore +
    WEIGHTS.priority * priorityScore +
    WEIGHTS.recency * recencyScore +
    WEIGHTS.keywordOverlap * keywordScore
  );
}
