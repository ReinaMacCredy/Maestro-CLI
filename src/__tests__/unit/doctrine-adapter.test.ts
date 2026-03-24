import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FsDoctrineAdapter } from '../../doctrine/adapter.ts';
import type { DoctrineItem } from '../../doctrine/port.ts';

let tmpDir: string;
let adapter: FsDoctrineAdapter;

function makeItem(name: string, overrides: Partial<DoctrineItem> = {}): DoctrineItem {
  return {
    name,
    rule: `Always run lint before committing ${name}`,
    rationale: `Prevents CI failures in ${name} area`,
    conditions: { tags: ['typescript', 'testing'] },
    tags: ['typescript', 'testing', 'lint'],
    source: { features: ['feat-1'], memories: ['exec-01-auth'] },
    effectiveness: { injectionCount: 0, associatedSuccessRate: 0, overrideCount: 0 },
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctrine-test-'));
  fs.mkdirSync(path.join(tmpDir, '.maestro'), { recursive: true });
  adapter = new FsDoctrineAdapter(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('FsDoctrineAdapter', () => {
  describe('write/read', () => {
    test('writes and reads a doctrine item', () => {
      const item = makeItem('always-lint');
      adapter.write(item);
      const read = adapter.read('always-lint');
      expect(read).not.toBeNull();
      expect(read!.name).toBe('always-lint');
      expect(read!.rule).toContain('Always run lint');
    });

    test('read returns null for non-existent item', () => {
      expect(adapter.read('does-not-exist')).toBeNull();
    });

    test('write creates doctrine directory', () => {
      const item = makeItem('test-item');
      adapter.write(item);
      expect(fs.existsSync(path.join(tmpDir, '.maestro', 'doctrine'))).toBe(true);
    });
  });

  describe('list', () => {
    test('lists all items', () => {
      adapter.write(makeItem('item-1'));
      adapter.write(makeItem('item-2'));
      adapter.write(makeItem('item-3', { status: 'deprecated' }));

      const all = adapter.list();
      expect(all.length).toBe(3);
    });

    test('filters by status', () => {
      adapter.write(makeItem('active-1'));
      adapter.write(makeItem('active-2'));
      adapter.write(makeItem('deprecated-1', { status: 'deprecated' }));

      const active = adapter.list({ status: 'active' });
      expect(active.length).toBe(2);

      const deprecated = adapter.list({ status: 'deprecated' });
      expect(deprecated.length).toBe(1);
    });

    test('returns empty for non-existent directory', () => {
      const emptyAdapter = new FsDoctrineAdapter(path.join(tmpDir, 'nonexistent'));
      expect(emptyAdapter.list()).toEqual([]);
    });

    test('skips malformed JSON files', () => {
      const docDir = path.join(tmpDir, '.maestro', 'doctrine');
      fs.mkdirSync(docDir, { recursive: true });
      fs.writeFileSync(path.join(docDir, 'bad.json'), 'not valid json');
      adapter.write(makeItem('good-item'));

      const items = adapter.list();
      expect(items.length).toBe(1);
      expect(items[0].name).toBe('good-item');
    });
  });

  describe('deprecate', () => {
    test('marks item as deprecated', () => {
      adapter.write(makeItem('to-deprecate'));
      const result = adapter.deprecate('to-deprecate');
      expect(result.status).toBe('deprecated');

      const read = adapter.read('to-deprecate');
      expect(read!.status).toBe('deprecated');
    });

    test('throws for non-existent item', () => {
      expect(() => adapter.deprecate('nope')).toThrow();
    });
  });

  describe('findRelevant', () => {
    test('returns items matching task tags', () => {
      adapter.write(makeItem('ts-lint', { tags: ['typescript', 'lint'], conditions: { tags: ['typescript'] } }));
      adapter.write(makeItem('python-lint', { tags: ['python', 'lint'], conditions: { tags: ['python'] } }));

      const results = adapter.findRelevant(
        ['typescript', 'testing'],
        new Set(['lint', 'commit']),
      );

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('ts-lint');
    });

    test('excludes deprecated items', () => {
      adapter.write(makeItem('active-item', { status: 'active' }));
      adapter.write(makeItem('deprecated-item', { status: 'deprecated' }));

      const results = adapter.findRelevant(['typescript', 'testing'], new Set(['lint']));
      expect(results.every(r => r.status === 'active')).toBe(true);
    });

    test('returns empty when no items match threshold', () => {
      adapter.write(makeItem('unrelated', { tags: ['python', 'ml'], conditions: { tags: ['python'] } }));

      const results = adapter.findRelevant(['rust', 'wasm'], new Set(['webassembly']));
      expect(results).toEqual([]);
    });

    test('sorts by relevance score descending', () => {
      adapter.write(makeItem('exact-match', {
        tags: ['typescript', 'testing', 'lint'],
        conditions: { tags: ['typescript', 'testing'] },
      }));
      adapter.write(makeItem('partial-match', {
        tags: ['typescript', 'database'],
        conditions: { tags: ['typescript'] },
      }));

      const results = adapter.findRelevant(
        ['typescript', 'testing', 'lint'],
        new Set(['lint', 'testing']),
      );

      expect(results.length).toBe(2);
      expect(results[0].name).toBe('exact-match');
    });
  });

  describe('recordInjection', () => {
    test('increments injection count and updates success rate', () => {
      adapter.write(makeItem('tracked'));
      adapter.recordInjection('tracked', true);
      adapter.recordInjection('tracked', true);
      adapter.recordInjection('tracked', false);

      const item = adapter.read('tracked')!;
      expect(item.effectiveness.injectionCount).toBe(3);
      expect(item.effectiveness.associatedSuccessRate).toBeCloseTo(2 / 3, 2);
      expect(item.effectiveness.overrideCount).toBe(1);
      expect(item.effectiveness.lastInjectedAt).toBeDefined();
    });

    test('silently skips non-existent item', () => {
      expect(() => adapter.recordInjection('nope', true)).not.toThrow();
    });

    test('updates running average correctly', () => {
      adapter.write(makeItem('avg-test'));

      // 3 successes
      for (let i = 0; i < 3; i++) adapter.recordInjection('avg-test', true);
      expect(adapter.read('avg-test')!.effectiveness.associatedSuccessRate).toBeCloseTo(1.0, 2);

      // 1 failure
      adapter.recordInjection('avg-test', false);
      expect(adapter.read('avg-test')!.effectiveness.associatedSuccessRate).toBeCloseTo(0.75, 2);
    });
  });
});
