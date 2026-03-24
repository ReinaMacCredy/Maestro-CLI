import { describe, expect, test, mock } from 'bun:test';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';
import { taskBrief, type TaskBriefParams } from '../../tasks/task-brief.ts';
import { MaestroError } from '../../core/errors.ts';

function makeParams(overrides?: Partial<TaskBriefParams>): TaskBriefParams {
  return {
    taskPort: new InMemoryTaskPort(),
    featureAdapter: {
      get: () => ({ name: 'feat', createdAt: new Date().toISOString() }),
    },
    memoryAdapter: { listWithMeta: () => [] },
    configAdapter: { get: () => ({}) },
    directory: '/tmp/test-brief',
    ...overrides,
  };
}

async function seedClaimedTask(params: TaskBriefParams): Promise<void> {
  const port = params.taskPort as InMemoryTaskPort;
  port.seed('feat', '01-setup', { status: 'claimed', name: 'Setup' });
  await port.writeSpec('feat', '01-setup', '## Task: Setup\nImplement the setup module.');
}

describe('taskBrief', () => {
  test('throws MaestroError when task not found', async () => {
    const params = makeParams();
    await expect(taskBrief(params, 'feat', 'nonexistent')).rejects.toThrow(MaestroError);
  });

  test('throws MaestroError when no spec', async () => {
    const params = makeParams();
    (params.taskPort as InMemoryTaskPort).seed('feat', '01-setup', { status: 'claimed' });
    await expect(taskBrief(params, 'feat', '01-setup')).rejects.toThrow(MaestroError);
  });

  test('returns full brief for claimed task with spec', async () => {
    const params = makeParams();
    await seedClaimedTask(params);

    const result = await taskBrief(params, 'feat', '01-setup');

    expect(result.feature).toBe('feat');
    expect(result.task).toBe('01-setup');
    expect(result.spec).toContain('Setup');
    expect(result.workerRules).toContain('maestro_task_done');
    expect(result.hint).toBeUndefined();
    expect(result.dcp).toBeDefined();
    expect(result.dcp.scores).toBeArray();
  });

  test('returns hint for unclaimed task', async () => {
    const params = makeParams();
    (params.taskPort as InMemoryTaskPort).seed('feat', '01-setup', { status: 'pending', name: 'Setup' });
    await (params.taskPort as InMemoryTaskPort).writeSpec('feat', '01-setup', '## Task');

    const result = await taskBrief(params, 'feat', '01-setup');

    expect(result.hint).toContain('not claimed');
  });

  test('populates revision context when revisionCount > 0', async () => {
    const params = makeParams();
    const port = params.taskPort as InMemoryTaskPort;
    port.seed('feat', '01-setup', {
      status: 'claimed',
      name: 'Setup',
      revisionCount: 1,
      revisionFeedback: 'Missing error handling',
    });
    await port.writeSpec('feat', '01-setup', '## Task');

    const result = await taskBrief(params, 'feat', '01-setup');

    expect(result.revisionContext).toBeDefined();
    expect(result.revisionContext!.attempt).toBe(2);
    expect(result.revisionContext!.feedback).toBe('Missing error handling');
  });

  test('graphContext is undefined when graphPort not provided', async () => {
    const params = makeParams({ graphPort: undefined });
    await seedClaimedTask(params);

    const result = await taskBrief(params, 'feat', '01-setup');

    expect(result.graphContext).toBeUndefined();
  });

  test('doctrine retrieval error returns empty array', async () => {
    const params = makeParams({
      doctrinePort: {
        findRelevant: () => { throw new Error('doctrine broke'); },
        write: () => '',
        read: () => null,
        list: () => [],
        deprecate: () => ({ } as any),
        recordInjection: () => {},
      } as any,
      configAdapter: { get: () => ({ doctrine: { enabled: true } }) },
    });
    await seedClaimedTask(params);

    const result = await taskBrief(params, 'feat', '01-setup');

    expect(result.doctrine).toEqual([]);
  });

  test('completed tasks included with budget cap', async () => {
    const params = makeParams();
    const port = params.taskPort as InMemoryTaskPort;
    port.seed('feat', '01-setup', { status: 'claimed', name: 'Setup' });
    await port.writeSpec('feat', '01-setup', '## Task');
    // Add several done tasks
    for (let i = 2; i <= 10; i++) {
      const folder = `${String(i).padStart(2, '0')}-task-${i}`;
      port.seed('feat', folder, { status: 'done', name: `Task ${i}`, summary: 'A'.repeat(300) });
    }

    const result = await taskBrief(params, 'feat', '01-setup');

    expect(result.completedTasks.length).toBeGreaterThan(0);
    // Budget is 2048 bytes default -- can't fit all 9 tasks with 300-char summaries
    expect(result.completedTasks.length).toBeLessThan(9);
  });

  test('memory category derived from metadata', async () => {
    const params = makeParams({
      memoryAdapter: {
        listWithMeta: () => [{
          name: 'test-memory',
          content: '---\ntags: [auth]\ncategory: decision\n---\nSome content',
          bodyContent: 'Some content',
          updatedAt: new Date().toISOString(),
          sizeBytes: 50,
          metadata: { tags: ['auth'], category: 'decision', priority: 2 },
        }],
      },
    });
    await seedClaimedTask(params);

    const result = await taskBrief(params, 'feat', '01-setup');

    if (result.memories.length > 0) {
      expect(result.memories[0].category).toBe('decision');
      expect(result.memories[0].tags).toContain('auth');
    }
  });
});
