import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { resolveTaskBackend } from '../../core/resolve-backend.ts';
import { checkCli } from '../../core/cli-detect.ts';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Use a unique temp dir per test run
const TEST_ROOT = join(tmpdir(), `resolve-backend-test-${Date.now()}`);

beforeEach(() => {
  mkdirSync(TEST_ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe('resolveTaskBackend', () => {
  test('explicit "fs" returns "fs"', () => {
    expect(resolveTaskBackend('fs', TEST_ROOT)).toBe('fs');
  });

  test('explicit "br" returns "br"', () => {
    expect(resolveTaskBackend('br', TEST_ROOT)).toBe('br');
  });

  test('"auto" with br binary + .beads/ returns "br"', () => {
    mkdirSync(join(TEST_ROOT, '.beads'), { recursive: true });
    const result = resolveTaskBackend('auto', TEST_ROOT);
    // Result depends on whether br is on PATH
    expect(result).toBe(checkCli('br') ? 'br' : 'fs');
  });

  test('"auto" without .beads/ returns "fs" even if br binary exists', () => {
    // No .beads/ in TEST_ROOT
    const result = resolveTaskBackend('auto', TEST_ROOT);
    expect(result).toBe('fs');
  });

  test('undefined behaves like "auto"', () => {
    const result = resolveTaskBackend(undefined, TEST_ROOT);
    expect(result).toBe('fs'); // no .beads/ in test root
  });

  test('no projectRoot skips .beads/ check', () => {
    const result = resolveTaskBackend('auto');
    // If br is available, returns 'br' (trusts binary); otherwise 'fs'
    expect(['fs', 'br']).toContain(result);
  });

  test('explicit values override auto-detection', () => {
    mkdirSync(join(TEST_ROOT, '.beads'), { recursive: true });
    // Even with .beads/ present, explicit 'fs' wins
    expect(resolveTaskBackend('fs', TEST_ROOT)).toBe('fs');
  });
});
