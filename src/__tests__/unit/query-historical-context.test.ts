import { describe, test, expect } from 'bun:test';
import { queryHistoricalContext, type HistoricalContextResult } from '../../dcp/historical.ts';
import { buildExecutionMemory } from '../../memory/execution/writer.ts';
import type { FeaturePort } from '../../features/port.ts';
import type { MemoryPort } from '../../memory/port.ts';
import type { FeatureJson, MemoryFileWithMeta } from '../../core/types.ts';

function makeFeatureAdapter(features: Array<{ name: string; createdAt: string; status?: string }>): FeaturePort {
  return {
    list: () => features.map(f => f.name),
    get: (name: string) => {
      const f = features.find(feat => feat.name === name);
      if (!f) return null;
      return { name: f.name, createdAt: f.createdAt, status: f.status ?? 'completed' } as FeatureJson;
    },
    create: () => ({} as FeatureJson),
    requireActive: () => ({} as FeatureJson),
    getActive: () => null,
    updateStatus: () => ({} as FeatureJson),
    getInfo: () => null,
    complete: () => ({} as FeatureJson),
    setSession: () => {},
    getSession: () => undefined,
  };
}

function makeMemoryAdapter(
  featureMemories: Record<string, Array<{ name: string; content: string }>>,
): MemoryPort {
  return {
    write: () => '',
    read: () => null,
    list: () => [],
    listWithMeta: (featureName: string) => {
      const memories = featureMemories[featureName] ?? [];
      return memories.map(m => ({
        name: m.name,
        content: m.content,
        updatedAt: new Date().toISOString(),
        sizeBytes: Buffer.byteLength(m.content),
        metadata: { tags: ['execution'], priority: 1, category: 'execution' as const },
        bodyContent: m.content,
      })) as MemoryFileWithMeta[];
    },
    delete: () => false,
    compile: () => '',
    archive: () => ({ archived: [], archivePath: '' }),
    stats: () => ({ count: 0, totalBytes: 0 }),
    writeGlobal: () => '',
    readGlobal: () => null,
    listGlobal: () => [],
    deleteGlobal: () => false,
  };
}

function makeExecMemory(folder: string, opts: {
  revisionCount?: number;
  verificationPassed?: boolean;
  claimedAt?: string;
  completedAt?: string;
  changedFiles?: string[];
  specContent?: string;
} = {}) {
  const result = buildExecutionMemory({
    taskFolder: folder,
    taskName: folder,
    summary: `Completed ${folder}`,
    verificationReport: opts.verificationPassed !== undefined
      ? {
          passed: opts.verificationPassed,
          score: opts.verificationPassed ? 1.0 : 0.3,
          criteria: [{ name: 'build', passed: opts.verificationPassed, detail: '' }],
          suggestions: [],
          timestamp: new Date().toISOString(),
        }
      : null,
    claimedAt: opts.claimedAt ?? '2025-01-01T00:00:00Z',
    completedAt: opts.completedAt ?? '2025-01-01T01:00:00Z',
    revisionCount: opts.revisionCount ?? 0,
    changedFiles: opts.changedFiles ?? ['src/auth.ts'],
    specContent: opts.specContent,
  });
  return { name: result.fileName, content: result.content };
}

describe('queryHistoricalContext', () => {
  test('returns empty for empty project', () => {
    const result = queryHistoricalContext(
      'Implement authentication module',
      makeFeatureAdapter([]),
      makeMemoryAdapter({}),
    );
    expect(result.pitfalls).toEqual([]);
    expect(result.featuresScanned).toBe(0);
    expect(result.totalExecMemoriesScanned).toBe(0);
  });

  test('returns empty when features have no exec memories', () => {
    const result = queryHistoricalContext(
      'Implement auth module',
      makeFeatureAdapter([
        { name: 'feat-1', createdAt: '2025-01-01T00:00:00Z' },
      ]),
      makeMemoryAdapter({ 'feat-1': [] }),
    );
    expect(result.pitfalls).toEqual([]);
    expect(result.featuresScanned).toBe(1);
  });

  test('returns empty when plan content has no meaningful keywords', () => {
    const result = queryHistoricalContext(
      'a b c',
      makeFeatureAdapter([
        { name: 'feat-1', createdAt: '2025-01-01T00:00:00Z' },
      ]),
      makeMemoryAdapter({
        'feat-1': [makeExecMemory('01-setup-auth', { revisionCount: 3 })],
      }),
    );
    expect(result.pitfalls).toEqual([]);
  });

  test('emits high severity pitfall for cross-feature revision pattern', () => {
    const result = queryHistoricalContext(
      'Implement setup and auth handling for the application',
      makeFeatureAdapter([
        { name: 'feat-1', createdAt: '2025-01-01T00:00:00Z' },
        { name: 'feat-2', createdAt: '2025-02-01T00:00:00Z' },
      ]),
      makeMemoryAdapter({
        'feat-1': [makeExecMemory('01-setup-auth', { revisionCount: 3 })],
        'feat-2': [makeExecMemory('01-setup-auth', { revisionCount: 2 })],
      }),
    );

    expect(result.pitfalls.length).toBeGreaterThanOrEqual(1);
    const highPitfall = result.pitfalls.find(p => p.severity === 'high');
    expect(highPitfall).toBeDefined();
    expect(highPitfall!.sourceFeatures).toContain('feat-1');
    expect(highPitfall!.sourceFeatures).toContain('feat-2');
  });

  test('emits medium severity pitfall for verification failure pattern', () => {
    const result = queryHistoricalContext(
      'Implement setup and auth module for authentication',
      makeFeatureAdapter([
        { name: 'feat-1', createdAt: '2025-01-01T00:00:00Z' },
        { name: 'feat-2', createdAt: '2025-02-01T00:00:00Z' },
      ]),
      makeMemoryAdapter({
        'feat-1': [makeExecMemory('01-setup-auth', { verificationPassed: false })],
        'feat-2': [makeExecMemory('01-setup-auth', { verificationPassed: false })],
      }),
    );

    const medPitfall = result.pitfalls.find(p => p.severity === 'medium' || p.severity === 'high');
    expect(medPitfall).toBeDefined();
  });

  test('excludes low-overlap memories', () => {
    const result = queryHistoricalContext(
      'Implement database migration pipeline',
      makeFeatureAdapter([
        { name: 'feat-1', createdAt: '2025-01-01T00:00:00Z' },
        { name: 'feat-2', createdAt: '2025-02-01T00:00:00Z' },
      ]),
      makeMemoryAdapter({
        'feat-1': [makeExecMemory('01-setup-auth', { revisionCount: 5 })],
        'feat-2': [makeExecMemory('01-setup-auth', { revisionCount: 5 })],
      }),
    );

    // "auth" tags don't overlap with "database migration pipeline" keywords
    expect(result.pitfalls).toEqual([]);
    expect(result.totalExecMemoriesScanned).toBe(2);
  });

  test('respects scanLimit option', () => {
    const result = queryHistoricalContext(
      'Implement setup auth',
      makeFeatureAdapter([
        { name: 'feat-1', createdAt: '2025-01-01T00:00:00Z' },
        { name: 'feat-2', createdAt: '2025-02-01T00:00:00Z' },
        { name: 'feat-3', createdAt: '2025-03-01T00:00:00Z' },
      ]),
      makeMemoryAdapter({
        'feat-1': [makeExecMemory('01-setup-auth', { revisionCount: 3 })],
        'feat-2': [makeExecMemory('01-setup-auth', { revisionCount: 3 })],
        'feat-3': [makeExecMemory('01-setup-auth', { revisionCount: 3 })],
      }),
      { scanLimit: 2 },
    );

    // Should only scan 2 most recent features
    expect(result.featuresScanned).toBe(2);
  });

  test('scans most recent features first', () => {
    const result = queryHistoricalContext(
      'Implement setup auth',
      makeFeatureAdapter([
        { name: 'old-feat', createdAt: '2024-01-01T00:00:00Z' },
        { name: 'new-feat', createdAt: '2025-06-01T00:00:00Z' },
      ]),
      makeMemoryAdapter({
        'old-feat': [makeExecMemory('01-setup-auth', { revisionCount: 3 })],
        'new-feat': [makeExecMemory('01-setup-auth', { revisionCount: 3 })],
      }),
      { scanLimit: 1 },
    );

    // Should scan only the newer feature
    expect(result.featuresScanned).toBe(1);
  });

  test('handles gracefully when listWithMeta throws', () => {
    const memoryAdapter = makeMemoryAdapter({});
    memoryAdapter.listWithMeta = (featureName: string) => {
      if (featureName === 'broken-feat') throw new Error('corrupted');
      return [];
    };

    const result = queryHistoricalContext(
      'Implement auth',
      makeFeatureAdapter([
        { name: 'broken-feat', createdAt: '2025-01-01T00:00:00Z' },
      ]),
      memoryAdapter,
    );

    expect(result.pitfalls).toEqual([]);
    expect(result.featuresScanned).toBe(1);
  });

  test('requires cross-feature signal (single feature not enough)', () => {
    const result = queryHistoricalContext(
      'Implement setup auth system',
      makeFeatureAdapter([
        { name: 'feat-1', createdAt: '2025-01-01T00:00:00Z' },
      ]),
      makeMemoryAdapter({
        'feat-1': [
          makeExecMemory('01-setup-auth', { revisionCount: 5 }),
          makeExecMemory('02-setup-auth', { revisionCount: 5 }),
        ],
      }),
    );

    // Both memories from same feature -- no cross-feature signal
    expect(result.pitfalls).toEqual([]);
  });

  test('handles missing fields in exec memories gracefully', () => {
    const bareMemory = {
      name: 'exec-01-setup-auth',
      content: `---
tags: [execution, setup, auth]
category: execution
priority: 1
---
Task **01-setup-auth** completed.

**Summary**: Did stuff`,
    };

    const result = queryHistoricalContext(
      'Implement setup and auth',
      makeFeatureAdapter([
        { name: 'feat-1', createdAt: '2025-01-01T00:00:00Z' },
        { name: 'feat-2', createdAt: '2025-02-01T00:00:00Z' },
      ]),
      makeMemoryAdapter({
        'feat-1': [bareMemory],
        'feat-2': [bareMemory],
      }),
    );

    // revisionCount defaults to 0, so no high-severity pitfall
    expect(result.pitfalls.filter(p => p.severity === 'high')).toEqual([]);
    expect(result.totalExecMemoriesScanned).toBe(2);
  });
});
