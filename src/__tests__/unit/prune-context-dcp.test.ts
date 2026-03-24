/**
 * Tests for prune-context DCP Phase 3:
 * - Legacy "## Prior Work" stripping from spec
 * - observationMasking: false fallback (all completed tasks, no budget)
 */

import { describe, test, expect } from 'bun:test';
import { pruneContext } from '../../dcp/prune-context.ts';
import type { MemoryFileWithMeta, TaskInfo } from '../../core/types.ts';

function makeMemory(name: string, bodyContent: string): MemoryFileWithMeta {
  return {
    name,
    content: bodyContent,
    updatedAt: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(bodyContent),
    metadata: { tags: [], priority: 2, category: 'research' },
    bodyContent,
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

describe('prune-context: legacy spec stripping', () => {
  test('strips "## Prior Work" section from spec', () => {
    const specWithPriorWork = [
      '# Add Widget',
      'Feature: test | Task 1 of 2',
      '',
      '## Specification',
      'Create the widget component.',
      '',
      '## Prior Work',
      '',
      '- **Setup DB**: Created the schema',
      '- **Auth**: Implemented JWT auth',
      '',
      '## Dependencies',
      '_None_',
    ].join('\n');

    const result = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: specWithPriorWork,
      memories: [],

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true },
    });

    expect(result.injection).not.toContain('## Prior Work');
    expect(result.injection).not.toContain('Created the schema');
    expect(result.injection).not.toContain('Implemented JWT auth');
    // Other sections preserved
    expect(result.injection).toContain('## Specification');
    expect(result.injection).toContain('Create the widget component.');
    expect(result.injection).toContain('## Dependencies');
  });

  test('spec without "## Prior Work" is unchanged', () => {
    const cleanSpec = '# Task\n\n## Specification\nDo the thing.\n\n## Dependencies\n_None_';

    const result = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: cleanSpec,
      memories: [],

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true },
    });

    expect(result.injection).toContain('Do the thing.');
    expect(result.injection).toContain('## Dependencies');
  });

  test('strips "## Prior Work" at end of spec (no trailing section)', () => {
    const specTrailing = '# Task\n\n## Spec\nContent.\n\n## Prior Work\n\n- **Old**: Done stuff';

    const result = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: specTrailing,
      memories: [],

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true },
    });

    expect(result.injection).not.toContain('## Prior Work');
    expect(result.injection).not.toContain('Done stuff');
    expect(result.injection).toContain('Content.');
  });
});

describe('prune-context: observationMasking fallback', () => {
  const completedTasks = [
    { name: 'task-1', summary: 'First task done' },
    { name: 'task-2', summary: 'Second task done' },
    { name: 'task-3', summary: 'Third task done' },
  ];

  test('observationMasking: false includes ALL completed tasks (no budget)', () => {
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
      dcpConfig: { enabled: true, observationMasking: false },
    });

    expect(result.injection).toContain('## Completed Tasks');
    expect(result.injection).toContain('task-1: First task done');
    expect(result.injection).toContain('task-2: Second task done');
    expect(result.injection).toContain('task-3: Third task done');
  });

  test('observationMasking: true budget-caps completed tasks (existing behavior)', () => {
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
      dcpConfig: { enabled: true, observationMasking: true, completedTaskBudgetBytes: 40 },
    });

    // With 40-byte budget, should include only newest (reversed) that fits
    expect(result.injection).toContain('## Completed Tasks');
    // Budget is tiny -- not all tasks should fit
    const matchCount = (result.injection.match(/task-\d: .+ done/g) || []).length;
    expect(matchCount).toBeLessThan(3);
  });

  test('observationMasking: false with no completed tasks: no section', () => {
    const result = pruneContext({
      featureName: 'test',
      taskFolder: '01-task',
      task: makeTask(),
      spec: 'Spec',
      memories: [],

      richContext: '',
      graphContext: '',
      workerRules: WORKER_RULES,
      dcpConfig: { enabled: true, observationMasking: false },
    });

    expect(result.injection).not.toContain('## Completed Tasks');
  });
});
