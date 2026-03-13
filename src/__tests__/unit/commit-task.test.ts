import { describe, test, expect, beforeEach } from 'bun:test';
import { commitTask } from '../../usecases/commit-task.ts';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';
import { createMockWorktreeAdapter } from '../mocks/mock-worktree-adapter.ts';

describe('commitTask', () => {
  let taskPort: InMemoryTaskPort;
  let taskFolder: string;
  const feature = 'test-feature';

  beforeEach(async () => {
    taskPort = new InMemoryTaskPort();
    const task = await taskPort.create(feature, 'Implement widget');
    taskFolder = task.folder;
    // Move task to in_progress so commitTask can transition it
    taskPort.setStatus(feature, taskFolder, 'in_progress');
  });

  test('completes task and writes report', async () => {
    const adapter = createMockWorktreeAdapter();
    const result = await commitTask(
      { taskPort, worktreeAdapter: adapter },
      { feature, task: taskFolder, status: 'completed', summary: 'Finished the widget' },
    );

    expect(result.success).toBe(true);

    // Verify task status was updated to done
    const taskInfo = await taskPort.get(feature, taskFolder);
    expect(taskInfo!.status).toBe('done');

    // Verify report was written
    const report = await taskPort.readReport(feature, taskFolder);
    expect(report).toContain('# Task Report');
    expect(report).toContain('Finished the widget');
  });

  test('marks completed as terminal', async () => {
    const adapter = createMockWorktreeAdapter();
    const result = await commitTask(
      { taskPort, worktreeAdapter: adapter },
      { feature, task: taskFolder, status: 'completed', summary: 'Done' },
    );

    expect(result.terminal).toBe(true);
    expect(result.nextAction).toBeUndefined();
  });

  test('marks failed as terminal', async () => {
    const adapter = createMockWorktreeAdapter();
    const result = await commitTask(
      { taskPort, worktreeAdapter: adapter },
      { feature, task: taskFolder, status: 'failed', summary: 'Could not finish' },
    );

    expect(result.terminal).toBe(true);
    expect(result.nextAction).toBeUndefined();
  });

  test('marks blocked as non-terminal with escalation hint', async () => {
    const adapter = createMockWorktreeAdapter();
    const result = await commitTask(
      { taskPort, worktreeAdapter: adapter },
      { feature, task: taskFolder, status: 'blocked', summary: 'Waiting on API' },
    );

    expect(result.terminal).toBe(false);
    expect(result.nextAction).toContain('Escalate blocker');
  });

  test('marks partial as non-terminal with review hint', async () => {
    const adapter = createMockWorktreeAdapter();
    const result = await commitTask(
      { taskPort, worktreeAdapter: adapter },
      { feature, task: taskFolder, status: 'partial', summary: 'Half done' },
    );

    expect(result.terminal).toBe(false);
    expect(result.nextAction).toContain('partial progress');
  });

  test('throws on invalid status string', async () => {
    const adapter = createMockWorktreeAdapter();

    await expect(
      commitTask(
        { taskPort, worktreeAdapter: adapter },
        { feature, task: taskFolder, status: 'bogus' as any, summary: 'Nope' },
      ),
    ).rejects.toThrow('Invalid status');
  });

  test('includes commit sha when changes were committed', async () => {
    const adapter = createMockWorktreeAdapter();
    const result = await commitTask(
      { taskPort, worktreeAdapter: adapter },
      { feature, task: taskFolder, status: 'completed', summary: 'With changes' },
    );

    expect(result.sha).toBe('abc123');
  });

  test('handles no changes committed gracefully', async () => {
    const adapter = createMockWorktreeAdapter({
      commitChanges: async () => ({ committed: false, sha: '' }),
    });
    const result = await commitTask(
      { taskPort, worktreeAdapter: adapter },
      { feature, task: taskFolder, status: 'completed', summary: 'No file changes' },
    );

    expect(result.success).toBe(true);
    expect(result.sha).toBeUndefined();

    const report = await taskPort.readReport(feature, taskFolder);
    expect(report).toContain('No changes committed');
  });

  test('writes report with correct markdown format', async () => {
    const adapter = createMockWorktreeAdapter();
    const result = await commitTask(
      { taskPort, worktreeAdapter: adapter },
      { feature, task: taskFolder, status: 'completed', summary: 'Built the API endpoint' },
    );

    const report = await taskPort.readReport(feature, taskFolder);
    expect(report).toContain(`# Task Report: ${taskFolder}`);
    expect(report).toContain('## Status: completed');
    expect(report).toContain('## Summary');
    expect(report).toContain('Built the API endpoint');
    expect(report).toContain('## Commit: abc123');
  });
});
