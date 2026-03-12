/**
 * E2E tests for core maestro workflow.
 * init --> feature-create --> plan-write --> plan-approve --> status
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { createTestHarness, type TestHarness } from '../mocks/test-harness.ts';

let harness: TestHarness;

afterEach(async () => {
  if (harness) await harness.cleanup();
});

describe('core workflow', () => {
  test('init creates .hive directory', async () => {
    harness = await createTestHarness();
    const result = await harness.run('init');

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.projectRoot).toBe(harness.dir);
    expect(parsed.hivePath).toContain('.hive');
  });

  test('feature-create creates a feature', async () => {
    harness = await createTestHarness();
    await harness.run('init');

    const result = await harness.run('feature-create', 'test-feature');
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.name).toBe('test-feature');
    expect(parsed.status).toBe('planning');
  });

  test('feature-create rejects duplicate', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('feature-create', 'test-feature');

    const result = await harness.run('feature-create', 'test-feature');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('already exists');
  });

  test('plan-write validates Discovery section', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('feature-create', 'test-feature');

    // Missing Discovery section
    const result = await harness.run('plan-write', '--feature', 'test-feature', '--content', '# Plan\nSome content');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Discovery');
  });

  test('plan-write succeeds with valid plan', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('feature-create', 'test-feature');

    const planContent = [
      '# Plan',
      '',
      '## Discovery',
      'We investigated the codebase thoroughly and found that the current implementation needs significant refactoring to support the new feature requirements.',
      '',
      '### 1. Setup Database',
      'Create the database schema',
      '',
      '### 2. Build API',
      'Implement REST endpoints',
    ].join('\n');

    const result = await harness.run('plan-write', '--feature', 'test-feature', '--content', planContent);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.taskCount).toBe(2);
  });

  test('plan-approve succeeds after plan-write', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('feature-create', 'test-feature');

    const planContent = [
      '## Discovery',
      'We investigated the codebase thoroughly and found that the current implementation needs significant refactoring to support the new feature requirements.',
      '',
      '### 1. Setup',
      'Setup the project',
    ].join('\n');

    await harness.run('plan-write', '--feature', 'test-feature', '--content', planContent);

    const result = await harness.run('plan-approve', '--feature', 'test-feature');
    expect(result.exitCode).toBe(0);
  });

  test('status shows feature overview after setup', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('feature-create', 'test-feature');

    const planContent = [
      '## Discovery',
      'We investigated the codebase thoroughly and found that the current implementation needs significant refactoring to support the new feature requirements.',
      '',
      '### 1. Setup',
      'Setup the project',
    ].join('\n');

    await harness.run('plan-write', '--feature', 'test-feature', '--content', planContent);
    await harness.run('plan-approve', '--feature', 'test-feature');

    const result = await harness.run('status', '--feature', 'test-feature');
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.feature.name).toBe('test-feature');
    expect(parsed.plan.approved).toBe(true);
  });
});
