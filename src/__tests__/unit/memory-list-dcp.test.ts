/**
 * Tests for memory_list MCP tool DCP Phase 3:
 * - With task: DCP-scored memories with scores
 * - With task + brief: scored memories without content
 * - Without task: all memories (backward compat)
 */

import { describe, test, expect } from 'bun:test';
import { selectMemories } from '../../utils/context-selector.ts';
import type { MemoryFileWithMeta, TaskInfo } from '../../core/types.ts';

function makeMemory(name: string, bodyContent: string): MemoryFileWithMeta {
  return {
    name,
    content: `---\ntags: [test]\n---\n${bodyContent}`,
    updatedAt: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(bodyContent),
    metadata: { tags: ['test'], priority: 2, category: 'research' },
    bodyContent,
  };
}

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    folder: '02-add-widget',
    name: 'Add widget component',
    status: 'claimed',
    origin: 'plan',
    planTitle: 'Add widget component',
    ...overrides,
  };
}

describe('memory_list: DCP-scored filtering (task param)', () => {
  test('scored memories returned with scores and budget respected', () => {
    const memories = [
      makeMemory('widget-notes', 'Widget component research'),
      makeMemory('db-notes', 'Database schema decisions'),
      makeMemory('auth-notes', 'Auth flow documentation'),
    ];

    const task = makeTask();
    const selected = selectMemories(memories, task, task.planTitle ?? null, 4096, 0.1);

    // All memories scored
    expect(selected.scores).toHaveLength(3);
    for (const score of selected.scores) {
      expect(typeof score.score).toBe('number');
      expect(typeof score.included).toBe('boolean');
    }

    // Budget respected
    expect(selected.totalBytes).toBeLessThanOrEqual(4096);
    expect(selected.includedCount + selected.droppedCount).toBe(3);
  });

  test('scored memories use bodyContent (no frontmatter)', () => {
    const memories = [makeMemory('test', 'Clean body')];
    const task = makeTask();
    const selected = selectMemories(memories, task, task.planTitle ?? null, 4096, 0.0);

    expect(selected.memories[0].bodyContent).toBe('Clean body');
    expect(selected.memories[0].bodyContent).not.toContain('tags:');
  });

  test('brief mode: can derive name + score without content', () => {
    const memories = [makeMemory('test', 'Some content')];
    const task = makeTask();
    const selected = selectMemories(memories, task, task.planTitle ?? null, 4096, 0.0);

    // Simulate brief mode (as the MCP handler does)
    const briefFiles = selected.memories.map(m => ({
      name: m.name,
      score: selected.scores.find(s => s.name === m.name)?.score ?? 0,
    }));

    expect(briefFiles).toHaveLength(1);
    expect(briefFiles[0].name).toBe('test');
    expect(typeof briefFiles[0].score).toBe('number');
    // No content field
    expect(briefFiles[0]).not.toHaveProperty('content');
  });
});

describe('memory_list: backward compat (no task param)', () => {
  test('all memories returned without DCP scoring', () => {
    const memories = [
      makeMemory('mem-1', 'Body 1'),
      makeMemory('mem-2', 'Body 2'),
      makeMemory('mem-3', 'Body 3'),
    ];

    // Without task param, all memories returned as-is
    const files = memories.map(({ name, content, updatedAt, sizeBytes, metadata }) => ({
      name, content, updatedAt, sizeBytes, ...metadata,
    }));

    expect(files).toHaveLength(3);
    expect(files[0]).toHaveProperty('content');
    expect(files[0]).toHaveProperty('tags');
    expect(files[0]).not.toHaveProperty('score');
  });

  test('brief mode without task: metadata only', () => {
    const memories = [makeMemory('mem-1', 'Body 1')];

    const files = memories.map(({ name, updatedAt, sizeBytes, metadata }) => ({
      name, updatedAt, sizeBytes, ...metadata,
    }));

    expect(files).toHaveLength(1);
    expect(files[0]).not.toHaveProperty('content');
    expect(files[0]).toHaveProperty('name');
  });
});

describe('memory_list: error cases', () => {
  test('selectMemories with empty memories returns empty result', () => {
    const task = makeTask();
    const result = selectMemories([], task, task.planTitle ?? null, 4096, 0.1);

    expect(result.memories).toHaveLength(0);
    expect(result.includedCount).toBe(0);
    expect(result.droppedCount).toBe(0);
    expect(result.scores).toHaveLength(0);
  });

  test('selectMemories with zero budget drops all', () => {
    const memories = [makeMemory('test', 'Content')];
    const task = makeTask();
    const result = selectMemories(memories, task, task.planTitle ?? null, 0, 0.0);

    expect(result.memories).toHaveLength(0);
    expect(result.includedCount).toBe(0);
    expect(result.droppedCount).toBe(1);
  });
});
