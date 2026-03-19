/**
 * E2E tests for plan lifecycle.
 * plan-write --> plan-read --> plan-comment --> plan-approve --> plan-revoke --> re-approve
 *
 * Covers: plan-comment, plan-comments-clear, plan-revoke, re-approval flow,
 *         plan validation edge cases.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { createTestHarness, type TestHarness } from '../mocks/test-harness.ts';

let harness: TestHarness;

afterEach(async () => {
  if (harness) await harness.cleanup();
});

const VALID_PLAN = [
  '## Discovery',
  'We investigated the codebase thoroughly and found that the current implementation needs significant refactoring to support the new feature requirements.',
  '',
  '### 1. Setup auth',
  'Configure authentication middleware',
  '',
  '### 2. Build endpoints',
  'Implement the REST API',
].join('\n');

/** Helper: init + feature-create */
async function setupFeature(h: TestHarness, name = 'test-feature') {
  await h.run('init');
  await h.run('feature-create', name);
}

describe('plan comments', () => {
  test('add comment and read it back via plan-read', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);
    await harness.run('plan-write', '--feature', 'test-feature', '--content', VALID_PLAN);

    // Add a comment
    const commentResult = await harness.run(
      'plan-comment', '--feature', 'test-feature',
      '--body', 'Consider using JWT instead of sessions',
      '--author', 'reviewer-1',
    );
    expect(commentResult.exitCode).toBe(0);

    // Read plan and verify comment is present
    const readResult = await harness.run('plan-read', '--feature', 'test-feature');
    expect(readResult.exitCode).toBe(0);
    const plan = JSON.parse(readResult.stdout);
    expect(plan.comments).toBeDefined();
    expect(plan.comments.length).toBeGreaterThanOrEqual(1);
    const comment = plan.comments.find((c: { body: string }) => c.body.includes('JWT'));
    expect(comment).toBeDefined();
    expect(comment.author).toBe('reviewer-1');
  });

  test('add comment with line number', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);
    await harness.run('plan-write', '--feature', 'test-feature', '--content', VALID_PLAN);

    const result = await harness.run(
      'plan-comment', '--feature', 'test-feature',
      '--body', 'This section needs more detail',
      '--line', '5',
    );
    expect(result.exitCode).toBe(0);
    const comment = JSON.parse(result.stdout);
    expect(comment.line).toBe(5);
  });

  test('default author is cli', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);
    await harness.run('plan-write', '--feature', 'test-feature', '--content', VALID_PLAN);

    const result = await harness.run(
      'plan-comment', '--feature', 'test-feature',
      '--body', 'Looks good',
    );
    expect(result.exitCode).toBe(0);
    const comment = JSON.parse(result.stdout);
    expect(comment.author).toBe('cli');
  });

  test('clear comments removes all comments', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);
    await harness.run('plan-write', '--feature', 'test-feature', '--content', VALID_PLAN);

    // Add two comments
    await harness.run('plan-comment', '--feature', 'test-feature', '--body', 'Comment 1');
    await harness.run('plan-comment', '--feature', 'test-feature', '--body', 'Comment 2');

    // Verify they exist
    const before = await harness.run('plan-read', '--feature', 'test-feature');
    const planBefore = JSON.parse(before.stdout);
    expect(planBefore.comments.length).toBeGreaterThanOrEqual(2);

    // Clear comments
    const clearResult = await harness.run('plan-comments-clear', '--feature', 'test-feature');
    expect(clearResult.exitCode).toBe(0);

    // Verify they're gone
    const after = await harness.run('plan-read', '--feature', 'test-feature');
    const planAfter = JSON.parse(after.stdout);
    expect(planAfter.comments).toHaveLength(0);
  });
});

describe('plan revoke and re-approve', () => {
  test('revoke approval returns feature to planning status', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);
    await harness.run('plan-write', '--feature', 'test-feature', '--content', VALID_PLAN);
    await harness.run('plan-approve', '--feature', 'test-feature');

    // Verify approved
    const statusBefore = await harness.run('status', '--feature', 'test-feature');
    const before = JSON.parse(statusBefore.stdout);
    expect(before.plan.approved).toBe(true);

    // Revoke
    const revokeResult = await harness.run('plan-revoke', '--feature', 'test-feature');
    expect(revokeResult.exitCode).toBe(0);

    // Verify reverted to planning
    const statusAfter = await harness.run('status', '--feature', 'test-feature');
    const after = JSON.parse(statusAfter.stdout);
    expect(after.plan.approved).toBe(false);
  });

  test('re-approve after revoke works', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);
    await harness.run('plan-write', '--feature', 'test-feature', '--content', VALID_PLAN);
    await harness.run('plan-approve', '--feature', 'test-feature');
    await harness.run('plan-revoke', '--feature', 'test-feature');

    // Re-approve
    const result = await harness.run('plan-approve', '--feature', 'test-feature');
    expect(result.exitCode).toBe(0);

    const status = await harness.run('status', '--feature', 'test-feature');
    const parsed = JSON.parse(status.stdout);
    expect(parsed.plan.approved).toBe(true);
  });
});

describe('plan write edge cases', () => {
  test('rejects plan without Discovery section', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    const result = await harness.run('plan-write', '--feature', 'test-feature', '--content', '# Plan\nSome content without discovery');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Discovery');
  });

  test('rejects plan with too-short Discovery section', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    const shortPlan = '## Discovery\nToo short.\n\n### 1. Task\nDo something';
    const result = await harness.run('plan-write', '--feature', 'test-feature', '--content', shortPlan);
    expect(result.exitCode).toBe(1);
  });

  test('plan-write overwrites existing plan', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    // Write initial plan
    await harness.run('plan-write', '--feature', 'test-feature', '--content', VALID_PLAN);

    // Overwrite with new plan
    const newPlan = VALID_PLAN.replace('Setup auth', 'Setup OAuth');
    const result = await harness.run('plan-write', '--feature', 'test-feature', '--content', newPlan);
    expect(result.exitCode).toBe(0);

    // Read back and verify
    const read = await harness.run('plan-read', '--feature', 'test-feature');
    const plan = JSON.parse(read.stdout);
    expect(plan.content).toContain('OAuth');
  });

  test('plan-read on feature without plan', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    const result = await harness.run('plan-read', '--feature', 'test-feature');
    // Should either return empty/null content or error
    if (result.exitCode === 0) {
      const parsed = JSON.parse(result.stdout);
      // Plan content should be empty/null
      expect(parsed.content === null || parsed.content === '' || parsed.content === undefined).toBe(true);
    } else {
      expect(result.exitCode).toBe(1);
    }
  });

  test('plan-approve on feature without plan fails', async () => {
    harness = await createTestHarness();
    await setupFeature(harness);

    const result = await harness.run('plan-approve', '--feature', 'test-feature');
    expect(result.exitCode).toBe(1);
  });
});
