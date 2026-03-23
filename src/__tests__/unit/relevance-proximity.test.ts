import { describe, test, expect } from 'bun:test';
import { scoreRelevance, type ProximityContext } from '../../utils/relevance.ts';
import { selectMemories } from '../../utils/context-selector.ts';
import { buildDownstreamMap } from '../../utils/dependency-proximity.ts';
import type { MemoryFileWithMeta, TaskInfo } from '../../core/types.ts';
import type { TaskWithDeps } from '../../utils/task-dependency-graph.ts';

function makeMemory(name: string, overrides: Partial<MemoryFileWithMeta> = {}): MemoryFileWithMeta {
  const bodyContent = overrides.bodyContent ?? `Content for ${name}`;
  return {
    name,
    content: bodyContent,
    updatedAt: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(bodyContent),
    metadata: { tags: ['execution'], priority: 1, category: 'execution' },
    bodyContent,
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    folder: '02-add-endpoints',
    name: 'Add API endpoints',
    status: 'claimed',
    origin: 'plan',
    ...overrides,
  };
}

function makeTaskDeps(): TaskWithDeps[] {
  return [
    { folder: '01-setup-auth', status: 'done', dependsOn: [] },
    { folder: '02-add-endpoints', status: 'claimed', dependsOn: ['01-setup-auth'] },
    { folder: '03-testing', status: 'pending', dependsOn: ['02-add-endpoints'] },
  ];
}

function makeProximityCtx(tasks: TaskWithDeps[]): ProximityContext {
  return { downstreamMap: buildDownstreamMap(tasks), taskFolders: new Set(tasks.map(t => t.folder)) };
}

describe('scoreRelevance with proximity', () => {
  test('execution memory from direct upstream scores higher without proximity context', () => {
    const mem = makeMemory('exec-01-setup-auth');
    const task = makeTask({ folder: '02-add-endpoints' });
    const pCtx = makeProximityCtx(makeTaskDeps());

    const scoreWithProximity = scoreRelevance(mem, task, null, undefined, undefined, pCtx);
    const scoreWithoutProximity = scoreRelevance(mem, task, null);

    expect(scoreWithProximity).toBeGreaterThan(scoreWithoutProximity);
    expect(scoreWithProximity - scoreWithoutProximity).toBeCloseTo(0.35, 2);
  });

  test('non-execution memory is unaffected by proximity context', () => {
    const mem = makeMemory('architecture-notes', {
      metadata: { tags: ['auth'], priority: 1, category: 'architecture' },
    });
    const task = makeTask();
    const pCtx = makeProximityCtx(makeTaskDeps());

    const scoreWith = scoreRelevance(mem, task, null, undefined, undefined, pCtx);
    const scoreWithout = scoreRelevance(mem, task, null);

    expect(scoreWith).toBe(scoreWithout);
  });

  test('execution memory from unrelated task gets no bonus', () => {
    const mem = makeMemory('exec-99-unrelated');
    const task = makeTask({ folder: '02-add-endpoints' });
    const pCtx = makeProximityCtx(makeTaskDeps());

    const scoreWith = scoreRelevance(mem, task, null, undefined, undefined, pCtx);
    const scoreWithout = scoreRelevance(mem, task, null);

    expect(scoreWith).toBe(scoreWithout);
  });

  test('score clamps at 1.0', () => {
    const mem = makeMemory('exec-01-setup-auth', {
      metadata: { tags: ['execution', 'auth', 'setup', 'endpoints'], priority: 0, category: 'architecture' },
      bodyContent: 'setup auth endpoints api configuration',
    });
    const task = makeTask({
      folder: '02-add-endpoints',
      name: 'Setup auth endpoints api configuration',
    });
    const pCtx = makeProximityCtx(makeTaskDeps());

    const score = scoreRelevance(mem, task, null, undefined, undefined, pCtx);
    expect(score).toBeLessThanOrEqual(1.0);
  });
});

describe('selectMemories with proximity', () => {
  test('passes task.folder as targetTaskFolder to scoreRelevance', () => {
    const upstream = makeMemory('exec-01-setup-auth', {
      bodyContent: 'Auth setup completed with JWT tokens',
    });
    const unrelated = makeMemory('design-notes', {
      metadata: { tags: [], priority: 2, category: 'research' },
      bodyContent: 'Some design notes',
    });
    const task = makeTask({ folder: '02-add-endpoints' });
    const allTasks = makeTaskDeps();

    const result = selectMemories(
      [upstream, unrelated], task, null, 4096, 0.1, undefined, allTasks,
    );

    // Upstream exec memory should score higher due to proximity bonus
    const execScore = result.scores.find(s => s.name === 'exec-01-setup-auth');
    const designScore = result.scores.find(s => s.name === 'design-notes');

    expect(execScore).toBeDefined();
    expect(designScore).toBeDefined();
    expect(execScore!.score).toBeGreaterThan(designScore!.score);
  });

  test('works without allTasks (backward compatible)', () => {
    const mem = makeMemory('exec-01-setup-auth');
    const task = makeTask();

    // No allTasks -- should not crash
    const result = selectMemories([mem], task, null, 4096, 0.1);
    expect(result.includedCount).toBe(1);
  });
});
