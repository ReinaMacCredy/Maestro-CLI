import { describe, test, expect } from 'bun:test';
import {
  COMPONENT_REGISTRY,
  allocateBudget,
  pruneComponents,
  type DcpComponent,
} from '../../dcp/components.ts';

describe('COMPONENT_REGISTRY', () => {
  test('has exactly 10 components', () => {
    expect(COMPONENT_REGISTRY).toHaveLength(10);
  });

  test('is sorted by priority ascending', () => {
    const priorities = COMPONENT_REGISTRY.map(c => c.priority);
    const sorted = [...priorities].sort((a, b) => a - b);
    expect(priorities).toEqual(sorted);
  });

  test('components 0-2 are protected', () => {
    const protected_ = COMPONENT_REGISTRY.filter(c => c.protected);
    expect(protected_).toHaveLength(3);
    expect(protected_.map(c => c.name)).toEqual(['spec', 'worker-rules', 'revision']);
  });

  test('components 3-9 are not protected', () => {
    const unprotected = COMPONENT_REGISTRY.filter(c => !c.protected);
    expect(unprotected).toHaveLength(7);
    expect(unprotected.every(c => c.priority >= 3)).toBe(true);
  });

  test('expected component names in order', () => {
    expect(COMPONENT_REGISTRY.map(c => c.name)).toEqual([
      'spec', 'worker-rules', 'revision', 'graph',
      'completed-tasks', 'doctrine', 'memories',
      'skills', 'agent-tools', 'handoff',
    ]);
  });

  test('estimateTokens returns chars/4', () => {
    const comp = COMPONENT_REGISTRY[0];
    expect(comp.estimateTokens('abcdefgh')).toBe(2); // 8 chars / 4
    expect(comp.estimateTokens('')).toBe(0);
  });
});

describe('allocateBudget', () => {
  function assembled(pairs: [string, string][]): Map<string, string> {
    return new Map(pairs);
  }

  test('protected components always get full budget', () => {
    const content = assembled([
      ['spec', 'x'.repeat(400)],       // 100 tokens
      ['worker-rules', 'x'.repeat(200)], // 50 tokens
      ['revision', 'x'.repeat(100)],     // 25 tokens
    ]);
    const result = allocateBudget(50, content); // budget less than protected total
    // Protected still get full allocation
    expect(result.get('spec')).toBe(100);
    expect(result.get('worker-rules')).toBe(50);
    expect(result.get('revision')).toBe(25);
  });

  test('unprotected components share remaining budget top-down', () => {
    const content = assembled([
      ['spec', 'x'.repeat(40)],           // 10 tokens
      ['worker-rules', 'x'.repeat(20)],   // 5 tokens
      ['revision', ''],                     // 0 tokens
      ['graph', 'x'.repeat(80)],           // 20 tokens
      ['memories', 'x'.repeat(120)],       // 30 tokens
      ['handoff', 'x'.repeat(40)],         // 10 tokens
    ]);
    // Budget: 50 total. Protected: 15. Remaining: 35
    // graph (pri 3): 20 -> remaining 15
    // memories (pri 6): needs 30, gets 15
    // handoff (pri 9): 0 remaining
    const result = allocateBudget(50, content);
    expect(result.get('graph')).toBe(20);
    expect(result.get('memories')).toBe(15);
    expect(result.get('handoff')).toBe(0);
  });

  test('missing components get 0', () => {
    const result = allocateBudget(1000, new Map());
    for (const comp of COMPONENT_REGISTRY) {
      expect(result.get(comp.name)).toBe(0);
    }
  });

  test('generous budget allocates everything', () => {
    const content = assembled([
      ['spec', 'x'.repeat(40)],
      ['worker-rules', 'x'.repeat(20)],
      ['revision', 'x'.repeat(20)],
      ['graph', 'x'.repeat(40)],
      ['doctrine', 'x'.repeat(40)],
      ['memories', 'x'.repeat(80)],
      ['handoff', 'x'.repeat(40)],
    ]);
    const result = allocateBudget(10000, content);
    expect(result.get('spec')).toBe(10);
    expect(result.get('graph')).toBe(10);
    expect(result.get('memories')).toBe(20);
    expect(result.get('handoff')).toBe(10);
  });
});

describe('pruneComponents', () => {
  function assembled(pairs: [string, string][]): Map<string, string> {
    return new Map(pairs);
  }

  test('protected components are never pruned', () => {
    const content = assembled([
      ['spec', 'x'.repeat(400)],           // 100 tokens
      ['worker-rules', 'x'.repeat(200)],   // 50 tokens
      ['revision', 'x'.repeat(100)],       // 25 tokens
      ['handoff', 'x'.repeat(40)],         // 10 tokens
    ]);
    // Budget 50 -- less than protected total (175), but protected stay
    const result = pruneComponents(content, 50);
    const includedNames = result.included.map(e => e.name);
    expect(includedNames).toContain('spec');
    expect(includedNames).toContain('worker-rules');
    expect(includedNames).toContain('revision');
    expect(result.dropped.map(e => e.name)).toContain('handoff');
  });

  test('drops lowest priority first when over budget', () => {
    const content = assembled([
      ['spec', 'x'.repeat(40)],            // 10 tokens
      ['worker-rules', 'x'.repeat(20)],    // 5 tokens
      ['revision', ''],
      ['graph', 'x'.repeat(40)],           // 10 tokens
      ['doctrine', 'x'.repeat(40)],        // 10 tokens
      ['memories', 'x'.repeat(40)],        // 10 tokens
      ['agent-tools', 'x'.repeat(40)],     // 10 tokens
      ['handoff', 'x'.repeat(40)],         // 10 tokens
    ]);
    // Protected: 15. Unprotected: 50. Budget: 45 total -> 30 for unprotected
    const result = pruneComponents(content, 45);
    const includedNames = result.included.map(e => e.name);
    const droppedNames = result.dropped.map(e => e.name);

    // graph, doctrine, memories fit (30 tokens), agent-tools and handoff dropped
    expect(includedNames).toContain('graph');
    expect(includedNames).toContain('doctrine');
    expect(includedNames).toContain('memories');
    expect(droppedNames).toContain('agent-tools');
    expect(droppedNames).toContain('handoff');
  });

  test('includes everything when budget is generous', () => {
    const content = assembled([
      ['spec', 'x'.repeat(40)],
      ['worker-rules', 'x'.repeat(20)],
      ['graph', 'x'.repeat(40)],
      ['memories', 'x'.repeat(80)],
    ]);
    const result = pruneComponents(content, 10000);
    expect(result.dropped).toHaveLength(0);
    expect(result.included).toHaveLength(4);
    expect(result.totalTokens).toBe(10 + 5 + 10 + 20);
  });

  test('skips empty components', () => {
    const content = assembled([
      ['spec', 'x'.repeat(40)],
      ['revision', ''],
      ['graph', ''],
    ]);
    const result = pruneComponents(content, 10000);
    expect(result.included).toHaveLength(1);
    expect(result.included[0].name).toBe('spec');
  });

  test('totalTokens matches sum of included', () => {
    const content = assembled([
      ['spec', 'x'.repeat(100)],
      ['worker-rules', 'x'.repeat(100)],
      ['graph', 'x'.repeat(100)],
      ['memories', 'x'.repeat(100)],
    ]);
    const result = pruneComponents(content, 10000);
    const sum = result.included.reduce((s, e) => s + e.tokens, 0);
    expect(result.totalTokens).toBe(sum);
  });

  test('empty assembled map returns empty result', () => {
    const result = pruneComponents(new Map(), 10000);
    expect(result.included).toHaveLength(0);
    expect(result.dropped).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
  });
});
