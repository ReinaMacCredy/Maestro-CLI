import { describe, test, expect } from 'bun:test';
import { isValidTransition, VALID_TRANSITIONS } from '../../ports/tasks.ts';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';

describe('isValidTransition', () => {
  test('pending -> in_progress is valid', () => {
    expect(isValidTransition('pending', 'in_progress')).toBe(true);
  });

  test('pending -> cancelled is valid', () => {
    expect(isValidTransition('pending', 'cancelled')).toBe(true);
  });

  test('pending -> done is invalid', () => {
    expect(isValidTransition('pending', 'done')).toBe(false);
  });

  test('in_progress -> done is valid', () => {
    expect(isValidTransition('in_progress', 'done')).toBe(true);
  });

  test('in_progress -> blocked is valid', () => {
    expect(isValidTransition('in_progress', 'blocked')).toBe(true);
  });

  test('in_progress -> failed is valid', () => {
    expect(isValidTransition('in_progress', 'failed')).toBe(true);
  });

  test('in_progress -> partial is valid', () => {
    expect(isValidTransition('in_progress', 'partial')).toBe(true);
  });

  test('done -> in_progress is invalid', () => {
    expect(isValidTransition('done', 'in_progress')).toBe(false);
  });

  test('done -> pending (reopen) is valid', () => {
    expect(isValidTransition('done', 'pending')).toBe(true);
  });

  test('failed -> pending (retry) is valid', () => {
    expect(isValidTransition('failed', 'pending')).toBe(true);
  });

  test('cancelled -> pending (reopen) is valid', () => {
    expect(isValidTransition('cancelled', 'pending')).toBe(true);
  });

  test('blocked -> in_progress is valid', () => {
    expect(isValidTransition('blocked', 'in_progress')).toBe(true);
  });

  test('partial -> in_progress is valid', () => {
    expect(isValidTransition('partial', 'in_progress')).toBe(true);
  });
});

describe('InMemoryTaskPort', () => {
  test('create and get', async () => {
    const port = new InMemoryTaskPort();
    const task = await port.create('test-feature', 'Setup API');
    expect(task.name).toBe('Setup API');
    expect(task.status).toBe('pending');

    const fetched = await port.get('test-feature', task.folder);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Setup API');
  });

  test('update enforces state machine', async () => {
    const port = new InMemoryTaskPort();
    const task = await port.create('feat', 'Task A');

    // pending -> done should fail
    await expect(port.update('feat', task.folder, { status: 'done' })).rejects.toThrow('Invalid transition');

    // pending -> in_progress should succeed
    const updated = await port.update('feat', task.folder, { status: 'in_progress' });
    expect(updated.status).toBe('in_progress');
  });

  test('getRunnable respects dependencies', async () => {
    const port = new InMemoryTaskPort();
    const taskA = await port.create('feat', 'Task A');
    const taskB = await port.create('feat', 'Task B');
    await port.addDependency('feat', taskB.folder, taskA.folder);

    // B depends on A, so only A should be runnable
    const runnable = await port.getRunnable('feat');
    expect(runnable.map(t => t.folder)).toContain(taskA.folder);
    expect(runnable.map(t => t.folder)).not.toContain(taskB.folder);
  });

  test('getRunnable unblocks after dependency done', async () => {
    const port = new InMemoryTaskPort();
    const taskA = await port.create('feat', 'Task A');
    const taskB = await port.create('feat', 'Task B');
    await port.addDependency('feat', taskB.folder, taskA.folder);

    // Complete task A
    port.setStatus('feat', taskA.folder, 'done');

    // Now B should be runnable
    const runnable = await port.getRunnable('feat');
    expect(runnable.map(t => t.folder)).toContain(taskB.folder);
  });

  test('getBlocked returns unmet dependencies', async () => {
    const port = new InMemoryTaskPort();
    const taskA = await port.create('feat', 'Task A');
    const taskB = await port.create('feat', 'Task B');
    await port.addDependency('feat', taskB.folder, taskA.folder);

    const blocked = await port.getBlocked('feat');
    expect(blocked[taskB.folder]).toEqual([taskA.folder]);
  });

  test('spec read/write round-trip', async () => {
    const port = new InMemoryTaskPort();
    const task = await port.create('feat', 'Task A');
    await port.writeSpec('feat', task.folder, 'spec content');

    const spec = await port.readSpec('feat', task.folder);
    expect(spec).toBe('spec content');
  });

  test('report read/write round-trip', async () => {
    const port = new InMemoryTaskPort();
    const task = await port.create('feat', 'Task A');
    await port.writeReport('feat', task.folder, 'report content');

    const report = await port.readReport('feat', task.folder);
    expect(report).toBe('report content');
  });
});
