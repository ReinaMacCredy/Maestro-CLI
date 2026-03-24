import { describe, test, expect } from 'bun:test';
import { findDuplicates } from '../../dcp/dedup.ts';
import type { MemoryFileWithMeta } from '../../core/types.ts';

function makeMemory(name: string, bodyContent: string): MemoryFileWithMeta {
  return {
    name,
    content: bodyContent,
    bodyContent,
    updatedAt: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(bodyContent),
    metadata: { tags: [], priority: 2, category: 'research' },
  };
}

describe('findDuplicates', () => {
  test('returns empty for fewer than 2 memories', () => {
    expect(findDuplicates([])).toEqual([]);
    expect(findDuplicates([makeMemory('a', 'content')])).toEqual([]);
  });

  test('detects near-duplicate memories', () => {
    const memories = [
      makeMemory('auth-design', 'authentication module design with JWT tokens and refresh logic'),
      makeMemory('auth-notes', 'authentication module design with JWT tokens and refresh implementation'),
      makeMemory('database-setup', 'PostgreSQL database connection pooling and migration setup'),
    ];

    const pairs = findDuplicates(memories);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    expect(pairs[0].a).toBe('auth-design');
    expect(pairs[0].b).toBe('auth-notes');
    expect(pairs[0].overlap).toBeGreaterThanOrEqual(0.8);
  });

  test('does not flag unrelated memories', () => {
    const memories = [
      makeMemory('auth', 'authentication JWT tokens refresh sessions'),
      makeMemory('database', 'PostgreSQL connection pooling migration schemas'),
    ];

    const pairs = findDuplicates(memories);
    expect(pairs).toHaveLength(0);
  });

  test('returns pairs sorted by overlap descending', () => {
    const memories = [
      makeMemory('a', 'authentication module design with tokens'),
      makeMemory('b', 'authentication module design with tokens exactly'),
      makeMemory('c', 'authentication module design with tokens exactly same words'),
    ];

    const pairs = findDuplicates(memories);
    for (let i = 1; i < pairs.length; i++) {
      expect(pairs[i].overlap).toBeLessThanOrEqual(pairs[i - 1].overlap);
    }
  });

  test('respects custom threshold', () => {
    const memories = [
      makeMemory('a', 'some shared words between these two memories about auth'),
      makeMemory('b', 'some shared words between these two different about databases'),
    ];

    // Low threshold should find more pairs
    const lowPairs = findDuplicates(memories, 0.3);
    const highPairs = findDuplicates(memories, 0.99);
    expect(lowPairs.length).toBeGreaterThanOrEqual(highPairs.length);
  });
});
