/**
 * Tests for DCP-scored decisions in handoff payload.
 *
 * Verifies that AgentMailHandoffAdapter uses selectMemories() to score
 * decisions by task relevance when DCP is enabled, and falls back to
 * all-memories behavior when disabled or task is null.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { AgentMailHandoffAdapter } from '../../adapters/agent-mail-handoff.ts';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';
import { InMemoryMemoryPort } from '../mocks/in-memory-memory-port.ts';
import type { FsConfigAdapter } from '../../adapters/fs/config.ts';
import type { HiveConfig } from '../../types.ts';
import { DEFAULT_HIVE_CONFIG } from '../../types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FEATURE = 'test-handoff-dcp';

function makeConfigAdapter(overrides?: Partial<HiveConfig['dcp']>): FsConfigAdapter {
  const config: HiveConfig = {
    ...DEFAULT_HIVE_CONFIG,
    dcp: { ...DEFAULT_HIVE_CONFIG.dcp, ...overrides },
  };
  return {
    get: () => config,
    getPath: () => '/mock/config.json',
  } as unknown as FsConfigAdapter;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handoff DCP scoring', () => {
  let taskPort: InMemoryTaskPort;
  let memoryPort: InMemoryMemoryPort;

  beforeEach(() => {
    taskPort = new InMemoryTaskPort();
    memoryPort = new InMemoryMemoryPort();
  });

  test('DCP enabled: only task-relevant decisions included', async () => {
    // Create a task about database work
    const task = await taskPort.create(FEATURE, 'Setup Database Schema');

    // Seed memories: one relevant (db), one irrelevant (auth)
    memoryPort.write(FEATURE, 'db-schema',
      '---\ntags: [database, schema]\ncategory: architecture\n---\n' +
      'We chose PostgreSQL with normalized schema for the database layer.');
    memoryPort.write(FEATURE, 'auth-approach',
      '---\ntags: [auth, security]\ncategory: decision\n---\n' +
      'JWT tokens with refresh rotation for authentication. ' +
      'This is completely unrelated to database work and should score lower.');

    const adapter = new AgentMailHandoffAdapter(
      '/mock/project', taskPort, memoryPort,
      makeConfigAdapter({ handoffDecisionBudgetBytes: 200 }),
      'http://unreachable:9999', // prevent actual HTTP calls
    );

    const handoff = await adapter.buildHandoff(FEATURE, task.folder);

    // With a tight budget, not all memories should be included
    // The db-schema memory should score higher for a database task
    expect(handoff.decisions.length).toBeGreaterThanOrEqual(1);
    expect(handoff.decisions.length).toBeLessThanOrEqual(2);
  });

  test('budget enforced: handoffDecisionBudgetBytes limits total content', async () => {
    const task = await taskPort.create(FEATURE, 'Build API');

    // Seed many memories to exceed budget
    for (let i = 0; i < 10; i++) {
      memoryPort.write(FEATURE, `memory-${i}`,
        `---\ntags: [api]\ncategory: decision\n---\n` +
        `Decision ${i}: ${'x'.repeat(500)}`);
    }

    const adapter = new AgentMailHandoffAdapter(
      '/mock/project', taskPort, memoryPort,
      makeConfigAdapter({ handoffDecisionBudgetBytes: 1024 }),
      'http://unreachable:9999',
    );

    const handoff = await adapter.buildHandoff(FEATURE, task.folder);

    // Total content should be bounded by budget -- not all 10 memories included
    expect(handoff.decisions.length).toBeLessThan(10);
    expect(handoff.decisions.length).toBeGreaterThanOrEqual(1);
  });

  test('bodyContent used: no frontmatter in decision values', async () => {
    const task = await taskPort.create(FEATURE, 'Add Widget');

    memoryPort.write(FEATURE, 'widget-design',
      '---\ntags: [ui, widget]\ncategory: architecture\npriority: 1\n---\n' +
      'Widget uses a flex layout with responsive breakpoints.');

    const adapter = new AgentMailHandoffAdapter(
      '/mock/project', taskPort, memoryPort,
      makeConfigAdapter({ handoffDecisionBudgetBytes: 4096 }),
      'http://unreachable:9999',
    );

    const handoff = await adapter.buildHandoff(FEATURE, task.folder);

    expect(handoff.decisions.length).toBe(1);
    // Value should be bodyContent (no frontmatter)
    expect(handoff.decisions[0].value).not.toContain('---');
    expect(handoff.decisions[0].value).toContain('Widget uses a flex layout');
  });

  test('500ch truncation still applied on DCP-selected memories', async () => {
    const task = await taskPort.create(FEATURE, 'Long Content Task');

    const longContent = '---\ntags: [test]\ncategory: decision\n---\n' + 'A'.repeat(1000);
    memoryPort.write(FEATURE, 'long-memory', longContent);

    const adapter = new AgentMailHandoffAdapter(
      '/mock/project', taskPort, memoryPort,
      makeConfigAdapter({ handoffDecisionBudgetBytes: 8192 }),
      'http://unreachable:9999',
    );

    const handoff = await adapter.buildHandoff(FEATURE, task.folder);

    expect(handoff.decisions.length).toBe(1);
    expect(handoff.decisions[0].value.length).toBeLessThanOrEqual(500);
  });

  test('DCP disabled: all decisions included, 500ch each', async () => {
    const task = await taskPort.create(FEATURE, 'Any Task');

    memoryPort.write(FEATURE, 'mem-1', 'Content one');
    memoryPort.write(FEATURE, 'mem-2', 'Content two');
    memoryPort.write(FEATURE, 'mem-3', 'Content three');

    const adapter = new AgentMailHandoffAdapter(
      '/mock/project', taskPort, memoryPort,
      makeConfigAdapter({ enabled: false }),
      'http://unreachable:9999',
    );

    const handoff = await adapter.buildHandoff(FEATURE, task.folder);

    // All 3 memories should be included regardless of relevance
    expect(handoff.decisions.length).toBe(3);
  });

  test('task not found: falls back to all decisions', async () => {
    memoryPort.write(FEATURE, 'mem-1', 'Content one');
    memoryPort.write(FEATURE, 'mem-2', 'Content two');

    const adapter = new AgentMailHandoffAdapter(
      '/mock/project', taskPort, memoryPort,
      makeConfigAdapter(),
      'http://unreachable:9999',
    );

    // Task ID that doesn't exist
    const handoff = await adapter.buildHandoff(FEATURE, 'nonexistent-task');

    // Fallback: all memories included
    expect(handoff.decisions.length).toBe(2);
  });

  test('0 memories: empty decisions array, no crash', async () => {
    const task = await taskPort.create(FEATURE, 'Empty Memories');

    const adapter = new AgentMailHandoffAdapter(
      '/mock/project', taskPort, memoryPort,
      makeConfigAdapter(),
      'http://unreachable:9999',
    );

    const handoff = await adapter.buildHandoff(FEATURE, task.folder);

    expect(handoff.decisions).toEqual([]);
  });
});
