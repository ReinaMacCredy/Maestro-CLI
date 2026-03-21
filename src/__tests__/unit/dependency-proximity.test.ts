import { describe, test, expect } from 'bun:test';
import {
  scoreDependencyProximity,
  extractSourceTask,
  buildDownstreamMap,
} from '../../utils/dependency-proximity.ts';
import type { TaskWithDeps } from '../../utils/task-dependency-graph.ts';

/**
 * Build task list. Pass `null` for deps to use implicit sequential ordering
 * (buildEffectiveDependencies infers from task number). Pass `[]` for explicit no-deps.
 */
function makeTasks(...specs: Array<[string, string[] | null]>): TaskWithDeps[] {
  return specs.map(([folder, deps]) => ({
    folder,
    status: 'done' as const,
    dependsOn: deps === null ? undefined : deps,
  }));
}

describe('extractSourceTask', () => {
  test('returns folder for exec- prefixed name', () => {
    expect(extractSourceTask('exec-01-setup-auth')).toBe('01-setup-auth');
  });

  test('returns null for non-exec name', () => {
    expect(extractSourceTask('my-memory')).toBeNull();
    expect(extractSourceTask('architecture-notes')).toBeNull();
  });

  test('returns empty string for exact "exec-" (edge case)', () => {
    expect(extractSourceTask('exec-')).toBe('');
  });

  test('handles exec- with complex folder names', () => {
    expect(extractSourceTask('exec-maestro-abc123-setup')).toBe('maestro-abc123-setup');
  });
});

describe('buildDownstreamMap', () => {
  test('inverts upstream map correctly for linear chain', () => {
    // T1 -> T2 -> T3 (T2 depends on T1, T3 depends on T2)
    const tasks = makeTasks(
      ['01-first', []],
      ['02-second', ['01-first']],
      ['03-third', ['02-second']],
    );
    const downstream = buildDownstreamMap(tasks);

    expect(downstream.get('01-first')).toEqual(['02-second']);
    expect(downstream.get('02-second')).toEqual(['03-third']);
    expect(downstream.get('03-third')).toBeUndefined();
  });

  test('handles diamond dependency', () => {
    // T1 -> T2, T1 -> T3, T2 -> T4, T3 -> T4
    const tasks = makeTasks(
      ['01-root', []],
      ['02-left', ['01-root']],
      ['03-right', ['01-root']],
      ['04-merge', ['02-left', '03-right']],
    );
    const downstream = buildDownstreamMap(tasks);

    const rootChildren = downstream.get('01-root') ?? [];
    expect(rootChildren).toContain('02-left');
    expect(rootChildren).toContain('03-right');
    expect(downstream.get('02-left')).toEqual(['04-merge']);
    expect(downstream.get('03-right')).toEqual(['04-merge']);
  });
});

describe('scoreDependencyProximity', () => {
  test('direct downstream (1 hop) returns 0.35', () => {
    const tasks = makeTasks(['01-first', []], ['02-second', ['01-first']]);
    const ds = buildDownstreamMap(tasks);
    expect(scoreDependencyProximity('01-first', '02-second', ds)).toBe(0.35);
  });

  test('transitive 2-hop returns 0.15', () => {
    const tasks = makeTasks(['01-first', []], ['02-second', ['01-first']], ['03-third', ['02-second']]);
    const ds = buildDownstreamMap(tasks);
    expect(scoreDependencyProximity('01-first', '03-third', ds)).toBe(0.15);
  });

  test('transitive 3-hop returns 0.05', () => {
    const tasks = makeTasks(['01-first', []], ['02-second', ['01-first']], ['03-third', ['02-second']], ['04-fourth', ['03-third']]);
    const ds = buildDownstreamMap(tasks);
    expect(scoreDependencyProximity('01-first', '04-fourth', ds)).toBe(0.05);
  });

  test('reverse direction (target upstream of source) returns 0', () => {
    const tasks = makeTasks(['01-first', []], ['02-second', ['01-first']]);
    const ds = buildDownstreamMap(tasks);
    expect(scoreDependencyProximity('02-second', '01-first', ds)).toBe(0);
  });

  test('same task returns 0', () => {
    const tasks = makeTasks(['01-first', []]);
    const ds = buildDownstreamMap(tasks);
    expect(scoreDependencyProximity('01-first', '01-first', ds)).toBe(0);
  });

  test('no relationship (explicit no-deps) returns 0', () => {
    const tasks: TaskWithDeps[] = [
      { folder: '01-first', status: 'done', dependsOn: [] },
      { folder: '02-second', status: 'done', dependsOn: [] },
    ];
    const ds = buildDownstreamMap(tasks);
    expect(scoreDependencyProximity('01-first', '02-second', ds)).toBe(0);
  });

  test('empty task list returns 0', () => {
    const ds = buildDownstreamMap([]);
    expect(scoreDependencyProximity('01-first', '02-second', ds)).toBe(0);
  });

  test('multiple paths takes shortest hop count', () => {
    const tasks = makeTasks(
      ['01-root', []], ['02-left', ['01-root']], ['03-right', ['01-root']],
      ['04-merge', ['02-left', '03-right', '01-root']],
    );
    const ds = buildDownstreamMap(tasks);
    expect(scoreDependencyProximity('01-root', '04-merge', ds)).toBe(0.35);
  });

  test('implicit sequential dependencies (no explicit dependsOn)', () => {
    const tasks = makeTasks(['01-first', null], ['02-second', null], ['03-third', null]);
    const ds = buildDownstreamMap(tasks);
    expect(scoreDependencyProximity('01-first', '02-second', ds)).toBe(0.35);
    expect(scoreDependencyProximity('01-first', '03-third', ds)).toBe(0.15);
  });
});
