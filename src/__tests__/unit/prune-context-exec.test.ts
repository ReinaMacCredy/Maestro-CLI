/**
 * Tests for execution/user memory partitioned rendering in pruneContext.
 */

import { describe, test, expect } from 'bun:test';
import { pruneContext } from '../../dcp/prune-context.ts';
import type { MemoryFileWithMeta, TaskInfo } from '../../core/types.ts';

function makeMemory(name: string, body: string, category = 'research'): MemoryFileWithMeta {
  return {
    name,
    content: `---\ncategory: ${category}\n---\n${body}`,
    updatedAt: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(body),
    metadata: { tags: [], priority: 2, category: category as MemoryFileWithMeta['metadata']['category'] },
    bodyContent: body,
  };
}

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    folder: '02-add-endpoints',
    name: 'Add endpoints',
    status: 'claimed',
    origin: 'plan',
    ...overrides,
  };
}

const BASE_PARAMS = {
  featureName: 'test',
  taskFolder: '02-add-endpoints',
  spec: 'Build endpoints',
  richContext: '',
  graphContext: '',
  workerRules: 'worker rules',
  dcpConfig: { enabled: true, memoryBudgetTokens: 1024, relevanceThreshold: 0.0 },
};

describe('pruneContext execution memory partitioning', () => {
  test('execution memories render under "Upstream Context" heading', () => {
    const memories = [
      makeMemory('exec-01-setup', 'Setup completed', 'execution'),
    ];
    const result = pruneContext({
      ...BASE_PARAMS,
      task: makeTask(),
      memories,
      completedTasks: [],
    });

    expect(result.injection).toContain('## Upstream Context (from completed tasks)');
    expect(result.injection).toContain('### exec-01-setup');
    expect(result.injection).not.toContain('## Feature Memories (DCP-selected)');
  });

  test('user memories render under "Feature Memories" heading', () => {
    const memories = [
      makeMemory('auth-decisions', 'Use JWT', 'decision'),
    ];
    const result = pruneContext({
      ...BASE_PARAMS,
      task: makeTask(),
      memories,
      completedTasks: [],
    });

    expect(result.injection).toContain('## Feature Memories (DCP-selected)');
    expect(result.injection).toContain('### auth-decisions');
    expect(result.injection).not.toContain('## Upstream Context');
  });

  test('mixed memories are partitioned correctly', () => {
    const memories = [
      makeMemory('exec-01-setup', 'Setup done', 'execution'),
      makeMemory('arch-notes', 'Architecture overview', 'architecture'),
      makeMemory('exec-02-build', 'Build done', 'execution'),
    ];
    const result = pruneContext({
      ...BASE_PARAMS,
      task: makeTask(),
      memories,
      completedTasks: [],
    });

    expect(result.injection).toContain('## Upstream Context (from completed tasks)');
    expect(result.injection).toContain('## Feature Memories (DCP-selected)');
    // Upstream context should come before feature memories
    const upstreamIdx = result.injection.indexOf('## Upstream Context');
    const featureIdx = result.injection.indexOf('## Feature Memories');
    expect(upstreamIdx).toBeLessThan(featureIdx);
  });

  test('no execution memories: no "Upstream Context" section', () => {
    const memories = [
      makeMemory('notes', 'Some notes', 'research'),
    ];
    const result = pruneContext({
      ...BASE_PARAMS,
      task: makeTask(),
      memories,
      completedTasks: [],
    });

    expect(result.injection).not.toContain('## Upstream Context');
    expect(result.injection).toContain('## Feature Memories (DCP-selected)');
  });

  test('only execution memories: no "Feature Memories" section', () => {
    const memories = [
      makeMemory('exec-01-setup', 'Setup', 'execution'),
    ];
    const result = pruneContext({
      ...BASE_PARAMS,
      task: makeTask(),
      memories,
      completedTasks: [],
    });

    expect(result.injection).toContain('## Upstream Context');
    expect(result.injection).not.toContain('## Feature Memories (DCP-selected)');
  });

  test('metrics track executionMemoriesIncluded', () => {
    const memories = [
      makeMemory('exec-01-setup', 'Setup', 'execution'),
      makeMemory('exec-02-build', 'Build', 'execution'),
      makeMemory('notes', 'Notes', 'research'),
    ];
    const result = pruneContext({
      ...BASE_PARAMS,
      task: makeTask(),
      memories,
      completedTasks: [],
    });

    expect(result.metrics.executionMemoriesIncluded).toBe(2);
    expect(result.metrics.memoriesIncluded).toBe(3);
  });

  test('memoryBytes reflects assembled string length including headings', () => {
    const memories = [
      makeMemory('exec-01-setup', 'Setup', 'execution'),
      makeMemory('notes', 'Notes', 'research'),
    ];
    const result = pruneContext({
      ...BASE_PARAMS,
      task: makeTask(),
      memories,
      completedTasks: [],
    });

    // memoryBytes should include heading overhead
    const expectedBytes = Buffer.byteLength(
      '\n## Upstream Context (from completed tasks)\n\n### exec-01-setup\n\nSetup' +
      '\n## Feature Memories (DCP-selected)\n\n### notes\n\nNotes',
    );
    expect(result.metrics.sections.memories).toBe(expectedBytes);
  });

  test('legacy mode (DCP disabled) sets executionMemoriesIncluded to 0', () => {
    const memories = [
      makeMemory('exec-01-setup', 'Setup', 'execution'),
    ];
    const result = pruneContext({
      ...BASE_PARAMS,
      task: makeTask(),
      memories,
      completedTasks: [],
      dcpConfig: { enabled: false },
    });

    expect(result.metrics.executionMemoriesIncluded).toBe(0);
  });
});
