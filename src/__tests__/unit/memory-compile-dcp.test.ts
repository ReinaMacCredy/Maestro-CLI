/**
 * Tests for memory-compile DCP Phase 3:
 * - --task flag: DCP-scored compile
 * - --budget flag: byte-capped compile (newest first)
 * - No flags: backward-compatible full dump
 */

import { describe, test, expect } from 'bun:test';
import { selectMemories } from '../../dcp/selector.ts';
import type { MemoryFileWithMeta, TaskInfo } from '../../core/types.ts';

// We test the selectMemories + budget logic directly since the CLI command
// is a thin wrapper around getServices() + these utilities.

function makeMemory(name: string, bodyContent: string, updatedAt?: string): MemoryFileWithMeta {
  return {
    name,
    content: `---\ntags: [test]\n---\n${bodyContent}`,
    updatedAt: updatedAt ?? new Date().toISOString(),
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

describe('memory-compile: DCP-scored compile (--task)', () => {
  test('only high-scoring memories included within budget', () => {
    const memories = [
      makeMemory('widget-research', 'Widget component patterns and best practices'),
      makeMemory('db-migration', 'Database migration notes for PostgreSQL'),
      makeMemory('auth-decision', 'Authentication flow decision using JWT'),
    ];

    const task = makeTask();
    const selected = selectMemories(memories, task, task.planTitle ?? null, 4096, 0.1);

    // selectMemories scores and filters -- result should be within budget
    expect(selected.totalBytes).toBeLessThanOrEqual(4096);
    expect(selected.includedCount + selected.droppedCount).toBe(3);
    expect(selected.scores).toHaveLength(3);
  });

  test('budget respected: large memories excluded', () => {
    const memories = [
      makeMemory('small', 'Short note'),
      makeMemory('large', 'x'.repeat(5000)),
    ];

    const task = makeTask();
    const selected = selectMemories(memories, task, task.planTitle ?? null, 100, 0.0);

    // Only the small one fits
    expect(selected.totalBytes).toBeLessThanOrEqual(100);
    expect(selected.includedCount).toBe(1);
    expect(selected.memories[0].name).toBe('small');
  });

  test('output uses bodyContent (no frontmatter)', () => {
    const memories = [makeMemory('test-mem', 'Clean body content')];
    const task = makeTask();
    const selected = selectMemories(memories, task, task.planTitle ?? null, 4096, 0.0);

    expect(selected.memories).toHaveLength(1);
    expect(selected.memories[0].bodyContent).toBe('Clean body content');
    expect(selected.memories[0].bodyContent).not.toContain('---');
  });
});

describe('memory-compile: budget-capped compile (--budget)', () => {
  test('newest-first fill within budget using bodyContent bytes', () => {
    const memories = [
      makeMemory('old', 'Old content', '2024-01-01T00:00:00Z'),
      makeMemory('mid', 'Mid content', '2024-06-01T00:00:00Z'),
      makeMemory('new', 'New content', '2024-12-01T00:00:00Z'),
    ];

    // Sort newest first (simulating the CLI behavior)
    const sorted = [...memories].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    const budget = Buffer.byteLength('New content') + Buffer.byteLength('Mid content') + 1;
    const included: typeof sorted = [];
    let usedBytes = 0;
    for (const m of sorted) {
      const mBytes = Buffer.byteLength(m.bodyContent);
      if (usedBytes + mBytes > budget) break;
      included.push(m);
      usedBytes += mBytes;
    }

    expect(included).toHaveLength(2);
    expect(included[0].name).toBe('new');
    expect(included[1].name).toBe('mid');
    expect(usedBytes).toBeLessThanOrEqual(budget);
  });

  test('zero budget includes nothing', () => {
    const memories = [makeMemory('test', 'Content')];

    const sorted = [...memories];
    const included: typeof sorted = [];
    let usedBytes = 0;
    for (const m of sorted) {
      const mBytes = Buffer.byteLength(m.bodyContent);
      if (usedBytes + mBytes > 0) break;
      included.push(m);
      usedBytes += mBytes;
    }

    expect(included).toHaveLength(0);
  });
});

describe('memory-compile: backward compat (no flags)', () => {
  test('all memories returned with full content (including frontmatter)', () => {
    const memories = [
      makeMemory('mem-1', 'Body 1'),
      makeMemory('mem-2', 'Body 2'),
    ];

    // Legacy compile concatenates all content (with frontmatter)
    const compiled = memories.map(m => m.content).join('\n\n---\n\n');
    expect(compiled).toContain('---\ntags: [test]\n---');
    expect(compiled).toContain('Body 1');
    expect(compiled).toContain('Body 2');
  });
});
