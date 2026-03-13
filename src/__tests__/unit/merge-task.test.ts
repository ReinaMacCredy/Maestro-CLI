import { describe, test, expect, beforeEach } from 'bun:test';
import { mergeTask } from '../../usecases/merge-task.ts';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';
import { createMockWorktreeAdapter } from '../mocks/mock-worktree-adapter.ts';

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
      { taskPort, worktreeAdapter: adapter },
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
        { taskPort, worktreeAdapter: adapter },
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
        { taskPort, worktreeAdapter: adapter },
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
        sha: '',
        filesChanged: [],
      }),
    });

    await expect(
      mergeTask(
        { taskPort, worktreeAdapter: adapter },
        { feature, task: taskFolder },
      ),
    ).rejects.toThrow('Branch diverged');
  });

  test('closes task after successful merge', async () => {
    const adapter = createMockWorktreeAdapter();
    await mergeTask(
      { taskPort, worktreeAdapter: adapter },
      { feature, task: taskFolder },
    );

    // close() sets status to done -- task should still be done
    const taskInfo = await taskPort.get(feature, taskFolder);
    expect(taskInfo!.status).toBe('done');
  });

  test('removes worktree after merge', async () => {
    const adapter = createMockWorktreeAdapter();
    await mergeTask(
      { taskPort, worktreeAdapter: adapter },
      { feature, task: taskFolder },
    );

    expect(adapter.calls.remove.length).toBe(1);
    expect(adapter.calls.remove[0]).toEqual([feature, taskFolder, true]);
  });

  test('uses merge strategy by default', async () => {
    const adapter = createMockWorktreeAdapter();
    await mergeTask(
      { taskPort, worktreeAdapter: adapter },
      { feature, task: taskFolder },
    );

    expect(adapter.calls.merge.length).toBe(1);
    expect(adapter.calls.merge[0][2]).toBe('merge');
  });

  test('returns filesChanged and sha from merge result', async () => {
    const adapter = createMockWorktreeAdapter();
    const result = await mergeTask(
      { taskPort, worktreeAdapter: adapter },
      { feature, task: taskFolder },
    );

    expect(result.sha).toBe('def456');
    expect(result.filesChanged).toEqual(['src/widget.ts', 'src/api.ts']);
  });
});
