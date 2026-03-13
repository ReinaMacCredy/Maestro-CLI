import { describe, test, expect, beforeEach } from 'bun:test';
import { mergeTask } from '../../usecases/merge-task.ts';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';

function createMockWorktreeAdapter(overrides: Partial<Record<string, any>> = {}) {
  const calls: Record<string, any[]> = { remove: [], merge: [], checkConflicts: [] };

  return {
    calls,
    commitChanges: async (_f: string, _t: string, _msg: string) => ({
      committed: true,
      sha: 'abc123',
    }),
    checkConflicts: overrides.checkConflicts ?? (async (_f: string, _t: string) => {
      calls.checkConflicts.push([_f, _t]);
      return [];
    }),
    merge: overrides.merge ?? (async (_f: string, _t: string, _s: string) => {
      calls.merge.push([_f, _t, _s]);
      return {
        success: true,
        merged: true,
        sha: 'def456',
        filesChanged: ['src/widget.ts', 'src/api.ts'],
      };
    }),
    remove: overrides.remove ?? (async (_f: string, _t: string, _d: boolean) => {
      calls.remove.push([_f, _t, _d]);
    }),
    create: async () => ({ path: '/tmp/wt', branch: 'test-branch' }),
  };
}

describe('mergeTask', () => {
  let taskPort: InMemoryTaskPort;
  let taskFolder: string;
  const feature = 'test-feature';

  beforeEach(async () => {
    taskPort = new InMemoryTaskPort();
    const task = await taskPort.create(feature, 'Implement widget');
    taskFolder = task.folder;
    // Move task to done so merge can proceed
    taskPort.setStatus(feature, taskFolder, 'done');
  });

  test('merges completed task successfully', async () => {
    const adapter = createMockWorktreeAdapter();
    const result = await mergeTask(
      { taskPort, worktreeAdapter: adapter as any },
      { feature, task: taskFolder },
    );

    expect(result.merged).toBe(true);
    expect(result.sha).toBe('def456');
  });

  test('throws if task status is not done', async () => {
    taskPort.setStatus(feature, taskFolder, 'in_progress');
    const adapter = createMockWorktreeAdapter();

    await expect(
      mergeTask(
        { taskPort, worktreeAdapter: adapter as any },
        { feature, task: taskFolder },
      ),
    ).rejects.toThrow("Cannot merge task");
  });

  test('throws on merge conflicts', async () => {
    const adapter = createMockWorktreeAdapter({
      checkConflicts: async () => ['src/widget.ts', 'src/api.ts'],
    });

    await expect(
      mergeTask(
        { taskPort, worktreeAdapter: adapter as any },
        { feature, task: taskFolder },
      ),
    ).rejects.toThrow('Merge conflicts detected');
  });

  test('throws on merge failure', async () => {
    const adapter = createMockWorktreeAdapter({
      merge: async () => ({
        success: false,
        merged: false,
        error: 'Branch diverged',
        conflicts: ['src/widget.ts'],
      }),
    });

    await expect(
      mergeTask(
        { taskPort, worktreeAdapter: adapter as any },
        { feature, task: taskFolder },
      ),
    ).rejects.toThrow('Branch diverged');
  });

  test('closes task after successful merge', async () => {
    const adapter = createMockWorktreeAdapter();
    await mergeTask(
      { taskPort, worktreeAdapter: adapter as any },
      { feature, task: taskFolder },
    );

    // close() sets status to done -- task should still be done
    const taskInfo = await taskPort.get(feature, taskFolder);
    expect(taskInfo!.status).toBe('done');
  });

  test('removes worktree after merge', async () => {
    const adapter = createMockWorktreeAdapter();
    await mergeTask(
      { taskPort, worktreeAdapter: adapter as any },
      { feature, task: taskFolder },
    );

    expect(adapter.calls.remove.length).toBe(1);
    expect(adapter.calls.remove[0]).toEqual([feature, taskFolder, true]);
  });

  test('uses merge strategy by default', async () => {
    const adapter = createMockWorktreeAdapter();
    await mergeTask(
      { taskPort, worktreeAdapter: adapter as any },
      { feature, task: taskFolder },
    );

    expect(adapter.calls.merge.length).toBe(1);
    expect(adapter.calls.merge[0][2]).toBe('merge');
  });

  test('returns filesChanged and sha from merge result', async () => {
    const adapter = createMockWorktreeAdapter();
    const result = await mergeTask(
      { taskPort, worktreeAdapter: adapter as any },
      { feature, task: taskFolder },
    );

    expect(result.sha).toBe('def456');
    expect(result.filesChanged).toEqual(['src/widget.ts', 'src/api.ts']);
  });
});
