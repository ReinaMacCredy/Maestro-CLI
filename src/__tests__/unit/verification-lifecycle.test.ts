/**
 * Unit tests for verification lifecycle state transitions.
 * Tests: claim->review, review->done (accept), review->revision (reject),
 * revision->claimed (re-claim), full cycle, getRunnable with new states.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';

const FEATURE = 'test-feature';

describe('verification state transitions', () => {
  let port: InMemoryTaskPort;

  beforeEach(() => {
    port = new InMemoryTaskPort();
  });

  test('claim -> done still works (backwards compat)', async () => {
    port.seed(FEATURE, '01-task', { status: 'pending' });
    await port.claim(FEATURE, '01-task', 'agent-1');
    const done = await port.done(FEATURE, '01-task', 'All done');
    expect(done.status).toBe('done');
    expect(done.summary).toBe('All done');
  });

  test('claim -> review when verification fails', async () => {
    port.seed(FEATURE, '01-task', { status: 'pending' });
    await port.claim(FEATURE, '01-task', 'agent-1');
    const review = await port.review(FEATURE, '01-task', 'Partial work');
    expect(review.status).toBe('review');
    expect(review.summary).toBe('Partial work');
  });

  test('review -> done (task_accept manual override)', async () => {
    port.seed(FEATURE, '01-task', { status: 'pending' });
    await port.claim(FEATURE, '01-task', 'agent-1');
    await port.review(FEATURE, '01-task', 'Partial');
    const accepted = await port.done(FEATURE, '01-task', 'Accepted despite issues');
    expect(accepted.status).toBe('done');
  });

  test('review -> revision (task_reject)', async () => {
    port.seed(FEATURE, '01-task', { status: 'pending' });
    await port.claim(FEATURE, '01-task', 'agent-1');
    await port.review(FEATURE, '01-task', 'Partial');
    const revised = await port.revision(FEATURE, '01-task', 'Fix the build', 1);
    expect(revised.status).toBe('revision');
    expect(revised.revisionFeedback).toBe('Fix the build');
    expect(revised.revisionCount).toBe(1);
    expect(revised.claimedBy).toBeUndefined();
  });

  test('revision -> claimed (re-claim preserves metadata)', async () => {
    port.seed(FEATURE, '01-task', { status: 'pending' });
    await port.claim(FEATURE, '01-task', 'agent-1');
    await port.review(FEATURE, '01-task', 'Partial');
    await port.revision(FEATURE, '01-task', 'Fix build', 1);
    const reclaimed = await port.claim(FEATURE, '01-task', 'agent-2');
    expect(reclaimed.status).toBe('claimed');
    expect(reclaimed.claimedBy).toBe('agent-2');
    // Revision metadata preserved
    expect(reclaimed.revisionFeedback).toBe('Fix build');
    expect(reclaimed.revisionCount).toBe(1);
  });

  test('full revision loop: claim -> review -> revision -> claim -> done', async () => {
    port.seed(FEATURE, '01-task', { status: 'pending' });

    // First attempt
    await port.claim(FEATURE, '01-task', 'agent-1');
    await port.review(FEATURE, '01-task', 'First attempt');
    await port.revision(FEATURE, '01-task', 'Fix tests', 1);

    // Second attempt
    await port.claim(FEATURE, '01-task', 'agent-1');
    const done = await port.done(FEATURE, '01-task', 'Fixed everything');
    expect(done.status).toBe('done');
    expect(done.summary).toBe('Fixed everything');
  });

  test('cannot review a non-claimed task', async () => {
    port.seed(FEATURE, '01-task', { status: 'pending' });
    await expect(port.review(FEATURE, '01-task', 'x')).rejects.toThrow();
  });

  test('cannot revise a non-review task', async () => {
    port.seed(FEATURE, '01-task', { status: 'claimed' });
    await expect(port.revision(FEATURE, '01-task', 'x', 1)).rejects.toThrow();
  });

  test('cannot claim a done task', async () => {
    port.seed(FEATURE, '01-task', { status: 'done' });
    await expect(port.claim(FEATURE, '01-task', 'a')).rejects.toThrow();
  });
});

describe('getRunnable with verification states', () => {
  let port: InMemoryTaskPort;

  beforeEach(() => {
    port = new InMemoryTaskPort();
  });

  test('revision tasks appear as claimable', async () => {
    port.seed(FEATURE, '01-task', { status: 'revision' });
    const runnable = await port.getRunnable(FEATURE);
    expect(runnable).toHaveLength(1);
    expect(runnable[0].folder).toBe('01-task');
  });

  test('review tasks satisfy dependencies', async () => {
    port.seed(FEATURE, '01-dep', { status: 'review' });
    port.seed(FEATURE, '02-task', { status: 'pending', dependsOn: ['01-dep'] });
    const runnable = await port.getRunnable(FEATURE);
    expect(runnable).toHaveLength(1);
    expect(runnable[0].folder).toBe('02-task');
  });

  test('revision tasks do NOT satisfy dependencies', async () => {
    port.seed(FEATURE, '01-dep', { status: 'revision' });
    port.seed(FEATURE, '02-task', { status: 'pending', dependsOn: ['01-dep'] });
    const runnable = await port.getRunnable(FEATURE);
    // Only 01-dep (revision) is runnable, not 02-task
    expect(runnable).toHaveLength(1);
    expect(runnable[0].folder).toBe('01-dep');
  });

  test('feature-complete rejects tasks in review', async () => {
    port.seed(FEATURE, '01-task', { status: 'review' });
    const tasks = await port.list(FEATURE, { includeAll: true });
    const incomplete = tasks.filter(t => t.status !== 'done');
    expect(incomplete).toHaveLength(1);
    expect(incomplete[0].status).toBe('review');
  });

  test('verification report round-trip', async () => {
    port.seed(FEATURE, '01-task');
    const report = {
      passed: false,
      score: 0.5,
      criteria: [{ name: 'build', passed: false, detail: 'fail' }],
      suggestions: ['Fix build'],
      timestamp: '2025-01-01T00:00:00Z',
    };
    await port.writeVerification(FEATURE, '01-task', report);
    const read = await port.readVerification(FEATURE, '01-task');
    expect(read).toEqual(report);
  });
});
