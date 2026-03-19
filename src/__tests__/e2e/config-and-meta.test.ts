/**
 * E2E tests for config, ping, feature-info, and feature-active commands.
 *
 * Covers: config-get, config-set, ping, feature-info, feature-active.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { createTestHarness, type TestHarness } from '../mocks/test-harness.ts';

let harness: TestHarness;

afterEach(async () => {
  if (harness) await harness.cleanup();
});

describe('config', () => {
  test('config-set and config-get round-trip', async () => {
    harness = await createTestHarness();
    await harness.run('init');

    // Set a string value
    const setResult = await harness.run('config-set', '--key', 'taskBackend', '--value', 'fs');
    expect(setResult.exitCode).toBe(0);

    // Get it back
    const getResult = await harness.run('config-get', '--key', 'taskBackend');
    expect(getResult.exitCode).toBe(0);
    const value = JSON.parse(getResult.stdout);
    expect(value).toBe('fs');
  });

  test('config-set with boolean value', async () => {
    harness = await createTestHarness();
    await harness.run('init');

    await harness.run('config-set', '--key', 'sandbox', '--value', 'true');
    const result = await harness.run('config-get', '--key', 'sandbox');
    expect(result.exitCode).toBe(0);
    const value = JSON.parse(result.stdout);
    expect(value).toBe(true);
  });

  test('config-set with numeric value', async () => {
    harness = await createTestHarness();
    await harness.run('init');

    await harness.run('config-set', '--key', 'claimExpiresMinutes', '--value', '60');
    const result = await harness.run('config-get', '--key', 'claimExpiresMinutes');
    expect(result.exitCode).toBe(0);
    const value = JSON.parse(result.stdout);
    expect(value).toBe(60);
  });

  test('config-get for nonexistent key fails', async () => {
    harness = await createTestHarness();
    await harness.run('init');

    const result = await harness.run('config-get', '--key', 'nonexistent');
    expect(result.exitCode).toBe(1);
  });
});

describe('ping', () => {
  test('returns version and project info', async () => {
    harness = await createTestHarness();
    await harness.run('init');

    const result = await harness.run('ping');
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.version).toBeDefined();
    expect(parsed.projectRoot).toBe(harness.dir);
  });
});

describe('feature-info', () => {
  test('shows feature details', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('feature-create', 'my-feature');

    const result = await harness.run('feature-info', '--feature', 'my-feature');
    expect(result.exitCode).toBe(0);
    const info = JSON.parse(result.stdout);
    expect(info.name).toBe('my-feature');
    expect(info.status).toBe('planning');
    expect(info.hasPlan).toBe(false);
  });

  test('shows hasPlan after plan-write', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('feature-create', 'my-feature');

    const plan = '## Discovery\nWe investigated the codebase thoroughly and found that the current implementation needs significant refactoring to support the new feature requirements.\n\n### 1. Task\nDo something';
    await harness.run('plan-write', '--feature', 'my-feature', '--content', plan);

    const result = await harness.run('feature-info', '--feature', 'my-feature');
    const info = JSON.parse(result.stdout);
    expect(info.hasPlan).toBe(true);
  });

  test('nonexistent feature fails', async () => {
    harness = await createTestHarness();
    await harness.run('init');

    const result = await harness.run('feature-info', '--feature', 'nonexistent');
    expect(result.exitCode).toBe(1);
  });
});

describe('feature-active', () => {
  test('shows active feature after creation', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('feature-create', 'active-test');

    const result = await harness.run('feature-active');
    expect(result.exitCode).toBe(0);
    // Should show active feature name
    const text = result.stdout;
    expect(text).toContain('active-test');
  });

  test('shows no active feature when none exists', async () => {
    harness = await createTestHarness();
    await harness.run('init');

    const result = await harness.run('feature-active');
    // Should succeed but indicate no active feature
    expect(result.exitCode).toBe(0);
  });
});

describe('status after token footprint changes', () => {
  test('status response structure is correct', async () => {
    harness = await createTestHarness();
    await harness.run('init');
    await harness.run('feature-create', 'test-feature');

    const plan = '## Discovery\nWe investigated the codebase thoroughly and found that the current implementation needs significant refactoring to support the new feature requirements.\n\n### 1. Task\nDo it';
    await harness.run('plan-write', '--feature', 'test-feature', '--content', plan);

    const result = await harness.run('status', '--feature', 'test-feature');
    expect(result.exitCode).toBe(0);
    const status = JSON.parse(result.stdout);

    // Core fields present
    expect(status.feature).toBeDefined();
    expect(status.plan).toBeDefined();
    expect(status.tasks).toBeDefined();
    expect(status.nextAction).toBeDefined();

    // Plan has status info
    expect(typeof status.plan.exists).toBe('boolean');
    expect(typeof status.plan.approved).toBe('boolean');

    // Tasks have summary counts
    expect(typeof status.tasks.total).toBe('number');
    expect(typeof status.tasks.done).toBe('number');
    expect(typeof status.tasks.pending).toBe('number');
  });
});
