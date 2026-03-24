import { describe, test, expect } from 'bun:test';
import { formatRichContext, formatGraphContext } from '../../hooks/pre-agent.ts';
import { WORKER_RULES } from '../../tasks/worker-rules.ts';
import { pruneContext } from '../../usecases/prune-context.ts';
import type { MemoryFileWithMeta, TaskInfo } from '../../core/types.ts';

function makeMemory(name: string, bodyContent: string, overrides: Partial<MemoryFileWithMeta> = {}): MemoryFileWithMeta {
  return {
    name,
    content: bodyContent,
    updatedAt: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(bodyContent),
    metadata: { tags: [], priority: 2, category: 'research' },
    bodyContent,
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    folder: '01-setup-auth',
    name: 'Setup authentication module',
    status: 'claimed',
    origin: 'plan',
    ...overrides,
  };
}

describe('formatRichContext', () => {
  test('formats design and AC when present', () => {
    const result = formatRichContext({
      status: 'fulfilled',
      value: { design: 'Use JWT', acceptanceCriteria: '- Token refresh works' },
    });
    expect(result).toContain('## Design Notes');
    expect(result).toContain('Use JWT');
    expect(result).toContain('## Acceptance Criteria');
    expect(result).toContain('Token refresh works');
  });

  test('returns empty for rejected promise', () => {
    const result = formatRichContext({
      status: 'rejected',
      reason: new Error('fail'),
    });
    expect(result).toBe('');
  });

  test('returns empty for null value', () => {
    const result = formatRichContext({
      status: 'fulfilled',
      value: null,
    });
    expect(result).toBe('');
  });

  test('returns empty for empty fields', () => {
    const result = formatRichContext({
      status: 'fulfilled',
      value: {},
    });
    expect(result).toBe('');
  });
});

describe('formatGraphContext', () => {
  test('flags critical path task', () => {
    const result = formatGraphContext(
      {
        status: 'fulfilled',
        value: {
          criticalPath: [{ id: '01-setup-auth', title: 'Setup auth' }],
          bottlenecks: [],
        },
      },
      '01-setup-auth',
      makeTask(),
    );
    expect(result).toContain('on critical path');
    expect(result).toContain('Prioritize correctness');
  });

  test('flags bottleneck task', () => {
    const result = formatGraphContext(
      {
        status: 'fulfilled',
        value: {
          criticalPath: [],
          bottlenecks: [{ id: '01-setup-auth', title: 'Setup auth' }],
        },
      },
      '01-setup-auth',
      makeTask(),
    );
    expect(result).toContain('bottleneck');
  });

  test('returns empty for non-critical task', () => {
    const result = formatGraphContext(
      {
        status: 'fulfilled',
        value: {
          criticalPath: [{ id: '02-other', title: 'Other task' }],
          bottlenecks: [],
        },
      },
      '01-setup-auth',
      makeTask(),
    );
    expect(result).toBe('');
  });

  test('returns empty for rejected promise', () => {
    const result = formatGraphContext(
      { status: 'rejected', reason: new Error('fail') },
      '01-setup-auth',
      makeTask(),
    );
    expect(result).toBe('');
  });
});

describe('pre-agent hook integration with pruneContext', () => {
  test('DCP enabled: relevant memories selected, bodyContent used', () => {
    const memories = [
      makeMemory('auth-research', 'Found that JWT is best for our auth flow', {
        metadata: { tags: ['auth'], priority: 1, category: 'decision' },
      }),
      makeMemory('unrelated-db', 'PostgreSQL backup strategies', {
        metadata: { tags: ['database'], priority: 3, category: 'research' },
      }),
    ];

    const { injection, metrics } = pruneContext({
      featureName: 'test-feature',
      taskFolder: '01-setup-auth',
      task: makeTask(),
      spec: 'Implement JWT authentication',
      memories,

      richContext: formatRichContext({ status: 'fulfilled', value: { design: 'Use JWT' } }),
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true, memoryBudgetBytes: 10000 },
    });

    expect(injection).toContain('Task Spec: 01-setup-auth');
    expect(injection).toContain('Implement JWT authentication');
    expect(injection).toContain(WORKER_RULES);
    expect(injection).toContain('Use JWT');
    expect(injection).toContain('DCP-selected');
    expect(metrics.memoriesTotal).toBe(2);
  });

  test('DCP disabled: current behavior preserved', () => {
    const memories = [
      makeMemory('note', 'Some note content'),
    ];

    const { injection } = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: 'Task spec',
      memories,

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: false },
    });

    expect(injection).toContain('Feature Memories');
    expect(injection).not.toContain('DCP-selected');
  });

  test('no memories: no crash', () => {
    const { injection, metrics } = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: 'Task spec',
      memories: [],

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true },
    });

    expect(injection).toContain('Task Spec');
    expect(metrics.memoriesTotal).toBe(0);
  });
});
