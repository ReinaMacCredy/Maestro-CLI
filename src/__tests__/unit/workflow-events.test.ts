import { describe, test, expect } from 'bun:test';
import { WorkflowEventBus, type WorkflowEvent } from '../../workflow/events.ts';

describe('WorkflowEventBus', () => {
  test('emits event to registered listener', () => {
    const bus = new WorkflowEventBus();
    const received: WorkflowEvent[] = [];
    bus.on('task-done', (e) => received.push(e));

    bus.emit({ type: 'task-done', timestamp: '2026-01-01', feature: 'f1', task: 't1' });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('task-done');
    expect(received[0].feature).toBe('f1');
  });

  test('does not emit to unrelated listeners', () => {
    const bus = new WorkflowEventBus();
    const received: WorkflowEvent[] = [];
    bus.on('plan-approved', (e) => received.push(e));

    bus.emit({ type: 'task-done', timestamp: '2026-01-01' });

    expect(received).toHaveLength(0);
  });

  test('supports multiple listeners on same type', () => {
    const bus = new WorkflowEventBus();
    let count = 0;
    bus.on('feature-complete', () => count++);
    bus.on('feature-complete', () => count++);

    bus.emit({ type: 'feature-complete', timestamp: '2026-01-01' });

    expect(count).toBe(2);
  });

  test('off removes a listener', () => {
    const bus = new WorkflowEventBus();
    let count = 0;
    const listener = () => count++;
    bus.on('task-claimed', listener);
    bus.off('task-claimed', listener);

    bus.emit({ type: 'task-claimed', timestamp: '2026-01-01' });

    expect(count).toBe(0);
  });

  test('listenerCount returns correct count', () => {
    const bus = new WorkflowEventBus();
    expect(bus.listenerCount('task-done')).toBe(0);

    const listener = () => {};
    bus.on('task-done', listener);
    expect(bus.listenerCount('task-done')).toBe(1);

    bus.off('task-done', listener);
    expect(bus.listenerCount('task-done')).toBe(0);
  });

  test('swallows listener errors without crashing', () => {
    const bus = new WorkflowEventBus();
    let secondCalled = false;
    bus.on('tasks-synced', () => { throw new Error('boom'); });
    bus.on('tasks-synced', () => { secondCalled = true; });

    bus.emit({ type: 'tasks-synced', timestamp: '2026-01-01' });

    expect(secondCalled).toBe(true);
  });

  test('emit with no listeners is a no-op', () => {
    const bus = new WorkflowEventBus();
    // Should not throw
    bus.emit({ type: 'tool-installed', timestamp: '2026-01-01' });
  });
});
