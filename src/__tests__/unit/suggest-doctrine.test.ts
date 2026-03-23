import { describe, test, expect } from 'bun:test';
import { suggestDoctrine } from '../../usecases/suggest-doctrine.ts';
import { buildExecutionMemory } from '../../utils/execution-memory.ts';
import type { FeaturePort } from '../../ports/features.ts';
import type { MemoryPort } from '../../ports/memory.ts';
import type { DoctrineItem } from '../../ports/doctrine.ts';
import type { FeatureJson, MemoryFileWithMeta } from '../../core/types.ts';

function makeFeatureAdapter(features: Array<{ name: string; createdAt: string }>): FeaturePort {
  return {
    list: () => features.map(f => f.name),
    get: (name: string) => {
      const f = features.find(feat => feat.name === name);
      if (!f) return null;
      return { name: f.name, createdAt: f.createdAt, status: 'completed' } as FeatureJson;
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

function makeExecMemory(folder: string, opts: { revisionCount?: number; verificationPassed?: boolean } = {}) {
  const result = buildExecutionMemory({
    taskFolder: folder,
    taskName: folder,
    summary: `Completed ${folder}`,
    verificationReport: opts.verificationPassed !== undefined
      ? { passed: opts.verificationPassed, score: opts.verificationPassed ? 1.0 : 0.3, criteria: [{ name: 'build', passed: opts.verificationPassed, detail: '' }], suggestions: [], timestamp: new Date().toISOString() }
      : null,
    claimedAt: '2025-01-01T00:00:00Z',
    completedAt: '2025-01-01T01:00:00Z',
    revisionCount: opts.revisionCount ?? 0,
    changedFiles: ['src/auth.ts'],
  });
  return { name: result.fileName, content: result.content };
}

function makeFeatures(count: number): Array<{ name: string; createdAt: string }> {
  return Array.from({ length: count }, (_, i) => ({
    name: `feat-${i + 1}`,
    createdAt: `2025-0${Math.min(i + 1, 9)}-01T00:00:00Z`,
  }));
}

function makeDoctrineItem(name: string, tags: string[], rule: string): DoctrineItem {
  return {
    name, rule, rationale: 'test', conditions: { tags }, tags,
    source: { features: [], memories: [] },
    effectiveness: { injectionCount: 0, associatedSuccessRate: 0, overrideCount: 0 },
    status: 'active', createdAt: '', updatedAt: '', schemaVersion: 1,
  };
}

describe('suggestDoctrine', () => {
  test('1 feature, 1 task -- no suggestions (below minSampleSize)', () => {
    const features = makeFeatures(1);
    const memories: Record<string, Array<{ name: string; content: string }>> = {
      'feat-1': [makeExecMemory('01-setup-auth', { revisionCount: 5 })],
    };

    const result = suggestDoctrine(makeFeatureAdapter(features), makeMemoryAdapter(memories), []);
    expect(result.suggestions).toEqual([]);
  });

  test('3 features, same failure -- no suggestions (below default minSampleSize of 5)', () => {
    const features = makeFeatures(3);
    const memories: Record<string, Array<{ name: string; content: string }>> = {};
    for (const f of features) {
      memories[f.name] = [makeExecMemory('01-setup-auth', { revisionCount: 3 })];
    }

    const result = suggestDoctrine(makeFeatureAdapter(features), makeMemoryAdapter(memories), []);
    expect(result.suggestions).toEqual([]);
  });

  test('5 features, same failure pattern in 4 -- suggests failure-prevention', () => {
    const features = makeFeatures(5);
    const memories: Record<string, Array<{ name: string; content: string }>> = {};
    for (let i = 0; i < 5; i++) {
      memories[features[i].name] = [makeExecMemory('01-setup-auth', { revisionCount: i < 4 ? 3 : 0 })];
    }

    const result = suggestDoctrine(makeFeatureAdapter(features), makeMemoryAdapter(memories), []);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(result.suggestions[0].category).toBe('failure-prevention');
    expect(result.suggestions[0].confidence).toBe('high');
  });

  test('5 features, each with different failure -- no suggestions', () => {
    const features = makeFeatures(5);
    const memories: Record<string, Array<{ name: string; content: string }>> = {};
    const folders = ['01-setup-auth', '02-build-api', '03-config-db', '04-test-runner', '05-deploy-infra'];
    for (let i = 0; i < 5; i++) {
      memories[features[i].name] = [makeExecMemory(folders[i], { revisionCount: 3 })];
    }

    const result = suggestDoctrine(makeFeatureAdapter(features), makeMemoryAdapter(memories), []);
    // Different folders -> different tag clusters -> no cluster reaches minSampleSize
    expect(result.suggestions).toEqual([]);
  });

  test('features with 0 exec memories -- skipped, no crash', () => {
    const features = makeFeatures(5);
    const memories: Record<string, Array<{ name: string; content: string }>> = {};
    for (const f of features) memories[f.name] = [];

    const result = suggestDoctrine(makeFeatureAdapter(features), makeMemoryAdapter(memories), []);
    expect(result.suggestions).toEqual([]);
    expect(result.analysisStats.execMemoriesAnalyzed).toBe(0);
  });

  test('deduplication: matching tags AND keywords suppresses duplicate', () => {
    const features = makeFeatures(5);
    const memories: Record<string, Array<{ name: string; content: string }>> = {};
    for (const f of features) {
      memories[f.name] = [makeExecMemory('01-setup-auth', { revisionCount: 3 })];
    }

    const existing = [makeDoctrineItem('existing-rule', ['setup', 'auth', 'typescript'],
      'Tasks involving setup, auth, and typescript frequently require revisions. Plan extra verification and test coverage.')];

    const result = suggestDoctrine(makeFeatureAdapter(features), makeMemoryAdapter(memories), existing);
    // Should be suppressed because existing doctrine has overlapping tags (3/3 = 100%) + keywords
    expect(result.suggestions).toEqual([]);
  });

  test('deduplication: same tags but different rule keywords does NOT suppress', () => {
    const features = makeFeatures(5);
    const memories: Record<string, Array<{ name: string; content: string }>> = {};
    for (const f of features) {
      memories[f.name] = [makeExecMemory('01-setup-auth', { revisionCount: 3 })];
    }

    const existing = [makeDoctrineItem('unrelated-rule', ['setup', 'auth'],
      'Always use HTTPS for production deployments of network services.')];

    const result = suggestDoctrine(makeFeatureAdapter(features), makeMemoryAdapter(memories), existing);
    // Different rule keywords -> should NOT be suppressed
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
  });

  test('respects minSampleSize config', () => {
    const features = makeFeatures(3);
    const memories: Record<string, Array<{ name: string; content: string }>> = {};
    for (const f of features) {
      memories[f.name] = [makeExecMemory('01-setup-auth', { revisionCount: 3 })];
    }

    // With minSampleSize of 2, should suggest
    const result = suggestDoctrine(
      makeFeatureAdapter(features), makeMemoryAdapter(memories), [],
      { minSampleSize: 2 },
    );
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
  });

  test('positive pattern detection', () => {
    const features = makeFeatures(5);
    const memories: Record<string, Array<{ name: string; content: string }>> = {};
    for (const f of features) {
      memories[f.name] = [makeExecMemory('01-setup-auth', { revisionCount: 0, verificationPassed: true })];
    }

    const result = suggestDoctrine(makeFeatureAdapter(features), makeMemoryAdapter(memories), []);
    const positives = result.suggestions.filter(s => s.category === 'positive-pattern');
    expect(positives.length).toBeGreaterThanOrEqual(1);
  });
});
