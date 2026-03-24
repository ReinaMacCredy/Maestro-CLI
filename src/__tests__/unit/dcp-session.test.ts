import { describe, test, expect } from 'bun:test';
import { createSessionState, recordInjection, getSessionSummary } from '../../dcp/session.ts';

describe('DcpSessionState', () => {
  test('createSessionState returns fresh state', () => {
    const state = createSessionState();
    expect(state.injectionCount).toBe(0);
    expect(state.totalTokensInjected).toBe(0);
    expect(state.memoriesSelected).toBe(0);
    expect(state.memoriesDropped).toBe(0);
    expect(state.startedAt).toBeDefined();
  });

  test('recordInjection accumulates metrics', () => {
    let state = createSessionState();
    state = recordInjection(state, {
      totalTokens: 500,
      memoriesIncluded: 3,
      memoriesDropped: 2,
      componentsIncluded: ['spec', 'memories', 'doctrine'],
    });

    expect(state.injectionCount).toBe(1);
    expect(state.totalTokensInjected).toBe(500);
    expect(state.memoriesSelected).toBe(3);
    expect(state.memoriesDropped).toBe(2);
    expect(state.componentHits['spec']).toBe(1);
    expect(state.componentHits['memories']).toBe(1);

    state = recordInjection(state, {
      totalTokens: 300,
      memoriesIncluded: 2,
      memoriesDropped: 1,
      componentsIncluded: ['spec', 'graph'],
    });

    expect(state.injectionCount).toBe(2);
    expect(state.totalTokensInjected).toBe(800);
    expect(state.memoriesSelected).toBe(5);
    expect(state.componentHits['spec']).toBe(2);
    expect(state.componentHits['graph']).toBe(1);
  });

  test('getSessionSummary formats readable output', () => {
    let state = createSessionState();
    state = recordInjection(state, {
      totalTokens: 1000,
      memoriesIncluded: 5,
      memoriesDropped: 3,
      componentsIncluded: ['spec', 'memories'],
    });

    const summary = getSessionSummary(state);
    expect(summary).toContain('1 injections');
    expect(summary).toContain('1000 tokens');
    expect(summary).toContain('5 selected');
    expect(summary).toContain('spec(1)');
  });

  test('recordInjection handles missing componentsIncluded', () => {
    let state = createSessionState();
    state = recordInjection(state, {
      totalTokens: 200,
      memoriesIncluded: 1,
      memoriesDropped: 0,
    });
    expect(state.injectionCount).toBe(1);
    expect(Object.keys(state.componentHits)).toHaveLength(0);
  });
});
