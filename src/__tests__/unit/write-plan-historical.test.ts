import { describe, test, expect } from 'bun:test';
import { writePlan, type WritePlanServices } from '../../usecases/write-plan.ts';
import type { PlanPort } from '../../plans/port.ts';
import type { FeaturePort } from '../../features/port.ts';
import type { MemoryPort } from '../../memory/port.ts';
import type { FeatureJson, MemoryFileWithMeta } from '../../core/types.ts';
import { buildExecutionMemory } from '../../utils/execution-memory.ts';

const VALID_PLAN = [
  '## Discovery',
  'We investigated the setup and auth codebase thoroughly and found the current implementation needs significant refactoring.',
  '',
  '### 1. Setup auth module',
  'Configure authentication middleware',
].join('\n');

function makePlanAdapter(): PlanPort {
  return {
    write: (_feature: string, _content: string) => '/tmp/plan.md',
    read: () => null,
    isApproved: () => false,
    addComment: () => ({ body: '', author: '', line: 0 }),
    listComments: () => [],
    clearComments: () => {},
    approve: () => '/tmp/APPROVED',
    revoke: () => {},
  };
}

function makeFeatureAdapter(features: Array<{ name: string; createdAt: string }> = []): FeaturePort {
  return {
    list: () => features.map(f => f.name),
    get: (name: string) => {
      const f = features.find(feat => feat.name === name);
      if (!f) return null;
      return { name: f.name, createdAt: f.createdAt, status: 'active' } as FeatureJson;
    },
    create: () => ({} as FeatureJson),
    requireActive: () => ({ name: 'test', createdAt: '2025-01-01', status: 'active' } as FeatureJson),
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

function makeExecMemory(folder: string, revisionCount: number) {
  const result = buildExecutionMemory({
    taskFolder: folder,
    taskName: folder,
    summary: `Completed ${folder}`,
    verificationReport: null,
    claimedAt: '2025-01-01T00:00:00Z',
    completedAt: '2025-01-01T01:00:00Z',
    revisionCount,
    changedFiles: ['src/auth.ts'],
  });
  return { name: result.fileName, content: result.content };
}

describe('writePlan with historical context', () => {
  test('includes historicalPitfalls when memoryAdapter provided and pitfalls found', async () => {
    const features = [
      { name: 'feat-1', createdAt: '2025-01-01T00:00:00Z' },
      { name: 'feat-2', createdAt: '2025-02-01T00:00:00Z' },
      { name: 'current', createdAt: '2025-03-01T00:00:00Z' },
    ];

    const services: WritePlanServices = {
      planAdapter: makePlanAdapter(),
      featureAdapter: makeFeatureAdapter(features),
      memoryAdapter: makeMemoryAdapter({
        'feat-1': [makeExecMemory('01-setup-auth', 3)],
        'feat-2': [makeExecMemory('01-setup-auth', 2)],
      }),
    };

    const result = await writePlan(services, 'current', VALID_PLAN);
    expect(result.historicalPitfalls).toBeDefined();
    expect(result.historicalPitfalls!.length).toBeGreaterThanOrEqual(1);
  });

  test('omits historicalPitfalls when memoryAdapter not provided', async () => {
    const services: WritePlanServices = {
      planAdapter: makePlanAdapter(),
      featureAdapter: makeFeatureAdapter([]),
    };

    const result = await writePlan(services, 'current', VALID_PLAN);
    expect(result.historicalPitfalls).toBeUndefined();
  });

  test('omits historicalPitfalls when no cross-feature signal exists', async () => {
    const services: WritePlanServices = {
      planAdapter: makePlanAdapter(),
      featureAdapter: makeFeatureAdapter([
        { name: 'current', createdAt: '2025-03-01T00:00:00Z' },
      ]),
      memoryAdapter: makeMemoryAdapter({}),
    };

    const result = await writePlan(services, 'current', VALID_PLAN);
    expect(result.historicalPitfalls).toBeUndefined();
  });

  test('does not block plan write when historical context throws', async () => {
    const badMemoryAdapter = makeMemoryAdapter({});
    badMemoryAdapter.listWithMeta = () => { throw new Error('boom'); };

    const features = [{ name: 'current', createdAt: '2025-03-01T00:00:00Z' }];
    const services: WritePlanServices = {
      planAdapter: makePlanAdapter(),
      featureAdapter: makeFeatureAdapter(features),
      memoryAdapter: badMemoryAdapter,
    };

    const result = await writePlan(services, 'current', VALID_PLAN);
    expect(result.path).toBe('/tmp/plan.md');
    expect(result.historicalPitfalls).toBeUndefined();
  });
});
