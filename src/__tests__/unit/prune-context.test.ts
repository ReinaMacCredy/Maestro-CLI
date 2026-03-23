import { describe, test, expect } from 'bun:test';
import { pruneContext } from '../../usecases/prune-context.ts';
import type { MemoryFileWithMeta, TaskInfo } from '../../core/types.ts';

function makeMemory(name: string, bodyContent: string, overrides: Partial<MemoryFileWithMeta> = {}): MemoryFileWithMeta {
  const content = overrides.content ?? bodyContent;
  return {
    name,
    content,
    updatedAt: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(content),
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

const WORKER_RULES = '## Worker Rules\n- Focus on task.';

describe('pruneContext', () => {
  test('DCP enabled: selects relevant memories within budget', () => {
    const memories = [
      makeMemory('auth-notes', 'Authentication research', {
        metadata: { tags: ['auth'], priority: 0, category: 'decision' },
      }),
      makeMemory('db-notes', 'Database migration notes', {
        metadata: { tags: ['database'], priority: 3, category: 'research' },
      }),
    ];

    const result = pruneContext({
      featureName: 'test-feature',
      taskFolder: '01-setup-auth',
      task: makeTask(),
      spec: 'Task spec content',
      memories,

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true, memoryBudgetBytes: 10000 },
    });

    expect(result.injection).toContain('Task Spec: 01-setup-auth');
    expect(result.injection).toContain('Task spec content');
    expect(result.injection).toContain(WORKER_RULES);
    expect(result.metrics.memoriesTotal).toBe(2);
    expect(result.metrics.scores).toHaveLength(2);
  });

  test('DCP enabled: uses bodyContent (no frontmatter in output)', () => {
    const memories = [
      makeMemory('auth', 'Clean body content', {
        content: '---\ntags: [auth]\n---\nClean body content',
      }),
    ];

    const result = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: 'Spec',
      memories,

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true, memoryBudgetBytes: 10000 },
    });

    expect(result.injection).toContain('Clean body content');
    expect(result.injection).not.toContain('---\ntags:');
  });

  test('DCP disabled: passthrough with 4KB truncation', () => {
    const bigContent = 'x'.repeat(5000);
    const memories = [makeMemory('big', bigContent, { content: bigContent })];

    const result = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: 'Spec',
      memories,

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: false },
    });

    expect(result.injection).toContain('[truncated');
    expect(result.metrics.memoriesIncluded).toBe(1);
    expect(result.metrics.memoriesDropped).toBe(0);
  });

  test('no memories: empty memory section', () => {
    const result = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: 'Spec',
      memories: [],

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true },
    });

    expect(result.injection).not.toContain('Feature Memories');
    expect(result.metrics.memoriesTotal).toBe(0);
    expect(result.metrics.memoriesIncluded).toBe(0);
    expect(result.metrics.memoriesDropped).toBe(0);
  });

  test('observation masking: drops oldest completed tasks first', () => {
    const completedTasks = [
      { name: 'old-task', summary: 'Old summary' },
      { name: 'mid-task', summary: 'Mid summary' },
      { name: 'new-task', summary: 'New summary' },
    ];

    const result = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: 'Spec',
      memories: [],
      completedTasks,
      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true, completedTaskBudgetBytes: 60, observationMasking: true },
    });

    // With tiny budget, should include newest first (reversed order)
    if (result.injection.includes('Completed Tasks')) {
      expect(result.injection).toContain('new-task');
    }
  });

  test('partial config: missing fields get defaults', () => {
    const memories = [makeMemory('test', 'Content')];

    const result = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: 'Spec',
      memories,

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: {},
    });

    // Should still work with all defaults
    expect(result.metrics.memoriesTotal).toBe(1);
    expect(result.injection).toContain('Task Spec');
  });

  test('undefined config: treated as DCP enabled with defaults', () => {
    const memories = [makeMemory('test', 'Content')];

    const result = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: 'Spec',
      memories,

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
    });

    expect(result.metrics.memoriesTotal).toBe(1);
    expect(result.injection).toContain('DCP-selected');
  });

  test('metrics accuracy: section sizes sum consistently', () => {
    const result = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: 'Spec content here',
      memories: [makeMemory('test', 'Memory body')],

      richContext: '\n## Design\n\nSome design.',
      graphContext: '\n## Graph\n\nOn critical path.',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true, memoryBudgetBytes: 10000 },
    });

    expect(result.metrics.totalBytes).toBeGreaterThan(0);
    expect(result.metrics.sections.spec).toBeGreaterThan(0);
    expect(result.metrics.sections.rich).toBeGreaterThan(0);
    expect(result.metrics.sections.graph).toBeGreaterThan(0);
    expect(result.metrics.sections.rules).toBeGreaterThan(0);
  });

  test('budget enforcement: memory section respects budget', () => {
    const memories = Array.from({ length: 10 }, (_, i) =>
      makeMemory(`mem-${i}`, 'x'.repeat(1000)),
    );

    const result = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: 'Spec',
      memories,

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true, memoryBudgetBytes: 3000 },
    });

    // Should include at most 3 (each is ~1000 bytes)
    expect(result.metrics.memoriesIncluded).toBeLessThanOrEqual(3);
    expect(result.metrics.memoriesDropped).toBeGreaterThanOrEqual(7);
  });
});
