import { describe, test, expect } from 'bun:test';
import { scoreByGoal } from '../../handoff/scorer.ts';
import type { MemoryFileWithMeta } from '../../core/types.ts';

function makeMemory(
  name: string,
  bodyContent: string,
  overrides: Partial<MemoryFileWithMeta> = {},
): MemoryFileWithMeta {
  return {
    name,
    content: bodyContent,
    bodyContent,
    updatedAt: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(bodyContent),
    metadata: { tags: [], priority: 2, category: 'research' },
    ...overrides,
  };
}

describe('scoreByGoal', () => {
  test('returns empty for empty memories', () => {
    expect(scoreByGoal([], 'authentication')).toEqual([]);
  });

  test('returns empty for empty goal', () => {
    const memories = [makeMemory('test', 'some content')];
    expect(scoreByGoal(memories, '')).toEqual([]);
  });

  test('scores all memories and sorts descending', () => {
    const memories = [
      makeMemory('low', 'unrelated topic about cooking'),
      makeMemory('high', 'authentication module uses JWT tokens with refresh', {
        metadata: { tags: ['auth'], priority: 0, category: 'decision' },
      }),
      makeMemory('mid', 'some authentication notes here', {
        metadata: { tags: [], priority: 2, category: 'research' },
      }),
    ];

    const result = scoreByGoal(memories, 'authentication JWT token handling');

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('high');
    // All scores should be between 0 and 1
    for (const r of result) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  test('higher priority memories score higher (all else equal)', () => {
    const memories = [
      makeMemory('pri4', 'test content about database', {
        metadata: { priority: 4, category: 'research' },
      }),
      makeMemory('pri0', 'test content about database', {
        metadata: { priority: 0, category: 'research' },
      }),
    ];

    const result = scoreByGoal(memories, 'database connection pooling');
    expect(result[0].name).toBe('pri0');
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  test('decision category scores higher than execution', () => {
    const memories = [
      makeMemory('exec', 'implementation details about routing', {
        metadata: { priority: 2, category: 'execution' },
      }),
      makeMemory('decision', 'routing architecture decisions', {
        metadata: { priority: 2, category: 'decision' },
      }),
    ];

    const result = scoreByGoal(memories, 'routing');
    expect(result[0].name).toBe('decision');
  });

  test('recent memories score higher than old ones', () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const memories = [
      makeMemory('old', 'API design decisions for authentication', {
        updatedAt: thirtyDaysAgo.toISOString(),
        metadata: { priority: 2, category: 'research' },
      }),
      makeMemory('new', 'API design decisions for authentication', {
        updatedAt: now.toISOString(),
        metadata: { priority: 2, category: 'research' },
      }),
    ];

    const result = scoreByGoal(memories, 'authentication API design');
    expect(result[0].name).toBe('new');
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  test('respects limit option', () => {
    const memories = Array.from({ length: 10 }, (_, i) =>
      makeMemory(`mem-${i}`, `content about topic ${i}`),
    );

    const result = scoreByGoal(memories, 'topic', { limit: 3 });
    expect(result).toHaveLength(3);
  });

  test('returns all when limit exceeds count', () => {
    const memories = [
      makeMemory('a', 'content'),
      makeMemory('b', 'content'),
    ];

    const result = scoreByGoal(memories, 'content', { limit: 10 });
    expect(result).toHaveLength(2);
  });

  test('keyword overlap drives ranking', () => {
    const memories = [
      makeMemory('no-match', 'unrelated cooking recipe notes'),
      makeMemory('match', 'database migration strategy with rollback plan'),
    ];

    const result = scoreByGoal(memories, 'database migration rollback');
    expect(result[0].name).toBe('match');
  });

  test('scored memory includes original memory object', () => {
    const mem = makeMemory('test', 'content here');
    const result = scoreByGoal([mem], 'content');
    expect(result[0].memory).toBe(mem);
    expect(result[0].name).toBe('test');
  });
});
