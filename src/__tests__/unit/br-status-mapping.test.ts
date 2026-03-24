import { describe, test, expect } from 'bun:test';
import { isValidTransition, VALID_TRANSITIONS } from '../../tasks/transitions.ts';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';

describe('isValidTransition', () => {
  test('pending -> claimed is valid', () => {
    expect(isValidTransition('pending', 'claimed')).toBe(true);
  });

  test('pending -> blocked is valid', () => {
    expect(isValidTransition('pending', 'blocked')).toBe(true);
  });

  test('pending -> done is invalid', () => {
    expect(isValidTransition('pending', 'done')).toBe(false);
  });

  test('claimed -> done is valid', () => {
    expect(isValidTransition('claimed', 'done')).toBe(true);
  });

  test('claimed -> blocked is valid', () => {
    expect(isValidTransition('claimed', 'blocked')).toBe(true);
  });

  test('claimed -> pending is valid', () => {
    expect(isValidTransition('claimed', 'pending')).toBe(true);
  });

  test('done -> pending (reopen) is valid', () => {
    expect(isValidTransition('done', 'pending')).toBe(true);
  });

  test('done -> claimed is invalid', () => {
    expect(isValidTransition('done', 'claimed')).toBe(false);
  });

  test('blocked -> pending is valid', () => {
    expect(isValidTransition('blocked', 'pending')).toBe(true);
  });

  test('blocked -> claimed is invalid', () => {
    expect(isValidTransition('blocked', 'claimed')).toBe(false);
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

  test('getRunnable respects dependencies', async () => {
    const port = new InMemoryTaskPort();
    const taskA = await port.create('feat', 'Task A');
    const taskB = await port.create('feat', 'Task B', { deps: [taskA.folder] });

    // B depends on A, so only A should be runnable
    const runnable = await port.getRunnable('feat');
    expect(runnable.map(t => t.folder)).toContain(taskA.folder);
    expect(runnable.map(t => t.folder)).not.toContain(taskB.folder);
  });

  test('getRunnable unblocks after dependency done', async () => {
    const port = new InMemoryTaskPort();
    const taskA = await port.create('feat', 'Task A');
    const taskB = await port.create('feat', 'Task B', { deps: [taskA.folder] });

    // Complete task A
    port.setStatus('feat', taskA.folder, 'done');

    // Now B should be runnable
    const runnable = await port.getRunnable('feat');
    expect(runnable.map(t => t.folder)).toContain(taskB.folder);
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
