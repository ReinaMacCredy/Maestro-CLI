import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { appendDoctrineTrace, readDoctrineTrace, collectDoctrineNames } from '../../utils/doctrine-trace.ts';
import { FsDoctrineAdapter } from '../../adapters/fs/doctrine.ts';
import type { DoctrineItem } from '../../doctrine/port.ts';

let tmpDir: string;

function makeItem(name: string, overrides: Partial<DoctrineItem> = {}): DoctrineItem {
  return {
    name,
    rule: `Rule for ${name}`,
    rationale: `Rationale for ${name}`,
    conditions: { tags: ['typescript'] },
    tags: ['typescript'],
    source: { features: [], memories: [] },
    effectiveness: { injectionCount: 0, associatedSuccessRate: 0, overrideCount: 0 },
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctrine-eff-'));
  // Create task directory structure
  const taskDir = path.join(tmpDir, '.maestro', 'features', 'test-feature', 'tasks', '01-test-task');
  fs.mkdirSync(taskDir, { recursive: true });
  // Create doctrine directory
  fs.mkdirSync(path.join(tmpDir, '.maestro', 'doctrine'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('doctrine trace', () => {
  test('writes and reads trace file', () => {
    appendDoctrineTrace(tmpDir, 'test-feature', '01-test-task', 0, ['always-lint']);

    const trace = readDoctrineTrace(tmpDir, 'test-feature', '01-test-task');
    expect(trace).not.toBeNull();
    expect(trace!.entries.length).toBe(1);
    expect(trace!.entries[0].doctrines).toEqual(['always-lint']);
    expect(trace!.entries[0].revision).toBe(0);
  });

  test('appends multiple entries across revision cycles', () => {
    appendDoctrineTrace(tmpDir, 'test-feature', '01-test-task', 0, ['always-lint', 'prefer-named-exports']);
    appendDoctrineTrace(tmpDir, 'test-feature', '01-test-task', 1, ['always-lint', 'check-circular-deps']);

    const trace = readDoctrineTrace(tmpDir, 'test-feature', '01-test-task');
    expect(trace!.entries.length).toBe(2);
    expect(trace!.entries[0].revision).toBe(0);
    expect(trace!.entries[1].revision).toBe(1);
  });

  test('collectDoctrineNames returns unique names across all entries', () => {
    appendDoctrineTrace(tmpDir, 'test-feature', '01-test-task', 0, ['always-lint', 'prefer-named-exports']);
    appendDoctrineTrace(tmpDir, 'test-feature', '01-test-task', 1, ['always-lint', 'check-circular-deps']);

    const trace = readDoctrineTrace(tmpDir, 'test-feature', '01-test-task')!;
    const names = collectDoctrineNames(trace);
    expect(names.sort()).toEqual(['always-lint', 'check-circular-deps', 'prefer-named-exports']);
  });

  test('skips write when no doctrine names', () => {
    appendDoctrineTrace(tmpDir, 'test-feature', '01-test-task', 0, []);
    const trace = readDoctrineTrace(tmpDir, 'test-feature', '01-test-task');
    expect(trace).toBeNull();
  });

  test('returns null for non-existent trace', () => {
    const trace = readDoctrineTrace(tmpDir, 'test-feature', 'nonexistent');
    expect(trace).toBeNull();
  });
});

describe('effectiveness recording via FsDoctrineAdapter', () => {
  test('recordInjection updates running average: 3 successes then 1 failure = 0.75', () => {
    const adapter = new FsDoctrineAdapter(tmpDir);
    adapter.write(makeItem('test-rule'));

    adapter.recordInjection('test-rule', true);
    adapter.recordInjection('test-rule', true);
    adapter.recordInjection('test-rule', true);
    adapter.recordInjection('test-rule', false);

    const item = adapter.read('test-rule')!;
    expect(item.effectiveness.injectionCount).toBe(4);
    expect(item.effectiveness.associatedSuccessRate).toBeCloseTo(0.75, 2);
    expect(item.effectiveness.overrideCount).toBe(1);
  });

  test('recordInjection silently skips when lock fails (non-existent item)', () => {
    const adapter = new FsDoctrineAdapter(tmpDir);
    expect(() => adapter.recordInjection('nonexistent', true)).not.toThrow();
  });

  test('staleness: 90+ day old lastInjectedAt is stale', () => {
    const adapter = new FsDoctrineAdapter(tmpDir);
    const staleDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    adapter.write(makeItem('stale-rule', {
      effectiveness: { injectionCount: 5, associatedSuccessRate: 0.8, overrideCount: 1, lastInjectedAt: staleDate },
    }));

    const item = adapter.read('stale-rule')!;
    const isStale = Date.now() - new Date(item.effectiveness.lastInjectedAt!).getTime() > 90 * 24 * 60 * 60 * 1000;
    expect(isStale).toBe(true);
  });

  test('staleness: never-injected + 30+ day old is stale', () => {
    const adapter = new FsDoctrineAdapter(tmpDir);
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    adapter.write(makeItem('never-injected', {
      createdAt: oldDate,
      effectiveness: { injectionCount: 0, associatedSuccessRate: 0, overrideCount: 0 },
    }));

    const item = adapter.read('never-injected')!;
    const neverInjected = item.effectiveness.injectionCount === 0;
    const createdOld = Date.now() - new Date(item.createdAt).getTime() > 30 * 24 * 60 * 60 * 1000;
    expect(neverInjected && createdOld).toBe(true);
  });
});
