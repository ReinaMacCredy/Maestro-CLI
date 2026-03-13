import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { createServicesThunk } from '../../server/_utils/services-thunk.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('createServicesThunk', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-thunk-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('throws when .maestro/ does not exist', () => {
    const thunk = createServicesThunk(tmpDir);
    expect(() => thunk.get()).toThrow('No .maestro/ directory found');
  });

  test('isInitialized returns false before get()', () => {
    const thunk = createServicesThunk(tmpDir);
    expect(thunk.isInitialized()).toBe(false);
  });

  test('initializes when .maestro/ exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.maestro', 'features'), { recursive: true });
    // Also need .beads for br adapter, but initServices should still work
    // even if br isn't available -- it just creates adapters
    const thunk = createServicesThunk(tmpDir);
    const services = thunk.get();
    expect(services).toBeDefined();
    expect(services.directory).toBe(tmpDir);
    expect(thunk.isInitialized()).toBe(true);
  });

  test('caches services after first get()', () => {
    fs.mkdirSync(path.join(tmpDir, '.maestro', 'features'), { recursive: true });
    const thunk = createServicesThunk(tmpDir);
    const first = thunk.get();
    const second = thunk.get();
    expect(first).toBe(second); // same reference
  });

  test('forceInit works without prior get()', () => {
    fs.mkdirSync(path.join(tmpDir, '.maestro', 'features'), { recursive: true });
    const thunk = createServicesThunk(tmpDir);
    const services = thunk.forceInit();
    expect(services).toBeDefined();
    expect(thunk.isInitialized()).toBe(true);
  });
});
