import { describe, test, expect } from 'bun:test';
import { pruneContext } from '../../usecases/prune-context.ts';
import { WORKER_RULES } from '../../utils/worker-rules.ts';
import type { MemoryFileWithMeta, TaskInfo } from '../../core/types.ts';

/**
 * Tests for DCP preview functionality.
 * The MCP tool and CLI command both call pruneContext() and format the metrics.
 * We test the metrics output directly.
 */

function makeMemory(name: string, bodyContent: string, overrides: Partial<MemoryFileWithMeta> = {}): MemoryFileWithMeta {
  return {
    name,
    content: bodyContent,
    updatedAt: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(bodyContent),
    metadata: { tags: [], priority: 2, category: 'research' },
    bodyContent,
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    folder: '01-setup-auth',
    name: 'Setup authentication module',
    status: 'claimed',
    origin: 'plan',
    ...overrides,
  };
}

describe('DCP preview metrics', () => {
  test('shows scored memories with inclusion status', () => {
    const memories = [
      makeMemory('auth-research', 'JWT token decision', {
        metadata: { tags: ['auth', 'security'], priority: 0, category: 'decision' },
      }),
      makeMemory('db-notes', 'Database migration notes', {
        metadata: { tags: ['database'], priority: 3, category: 'research' },
      }),
      makeMemory('api-design', 'API endpoint architecture', {
        metadata: { tags: ['api'], priority: 2, category: 'architecture' },
      }),
    ];

    const { metrics } = pruneContext({
      featureName: 'test-feature',
      taskFolder: '01-setup-auth',
      task: makeTask(),
      spec: 'Implement JWT auth',
      memories,

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true, memoryBudgetBytes: 10000 },
    });

    expect(metrics.memoriesTotal).toBe(3);
    expect(metrics.scores).toHaveLength(3);
    // All scores should be numbers between 0 and 1
    expect(metrics.scores.every(s => s.score >= 0 && s.score <= 1)).toBe(true);
    // All should have name and included flag
    expect(metrics.scores.every(s => typeof s.name === 'string' && typeof s.included === 'boolean')).toBe(true);
  });

  test('respects budget constraint in preview', () => {
    const memories = Array.from({ length: 8 }, (_, i) =>
      makeMemory(`memory-${i}`, `Content for memory ${i} with enough text to be meaningful.`),
    );

    const { metrics } = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: 'Task spec',
      memories,

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true, memoryBudgetBytes: 200 },
    });

    expect(metrics.memoriesTotal).toBe(8);
    expect(metrics.memoriesIncluded).toBeLessThan(8);
    expect(metrics.memoriesDropped).toBeGreaterThan(0);
    expect(metrics.memoriesIncluded + metrics.memoriesDropped).toBe(8);
  });

  test('sections sizes reported correctly', () => {
    const { metrics } = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: 'Task specification content',
      memories: [makeMemory('note', 'Some memory')],

      richContext: '\n## Design\n\nDesign notes here.',
      graphContext: '\n## Graph\n\nCritical path.',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true, memoryBudgetBytes: 10000 },
    });

    expect(metrics.sections.spec).toBeGreaterThan(0);
    expect(metrics.sections.memories).toBeGreaterThan(0);
    expect(metrics.sections.rich).toBeGreaterThan(0);
    expect(metrics.sections.graph).toBeGreaterThan(0);
    expect(metrics.sections.rules).toBeGreaterThan(0);
    expect(metrics.totalBytes).toBeGreaterThan(0);
  });

  test('empty feature shows zero memories', () => {
    const { metrics } = pruneContext({
      featureName: 'empty-feature',
      taskFolder: '01-task',
      task: makeTask(),
      spec: 'Spec',
      memories: [],

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true },
    });

    expect(metrics.memoriesTotal).toBe(0);
    expect(metrics.memoriesIncluded).toBe(0);
    expect(metrics.memoriesDropped).toBe(0);
    expect(metrics.scores).toEqual([]);
  });
});
