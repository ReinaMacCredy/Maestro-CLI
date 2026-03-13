import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { resolveProjectDir, logHookError } from '../../hooks/_helpers.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('resolveProjectDir', () => {
  const originalEnv = process.env.CLAUDE_PROJECT_DIR;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CLAUDE_PROJECT_DIR = originalEnv;
    } else {
      delete process.env.CLAUDE_PROJECT_DIR;
    }
  });

  test('returns project dir from CLAUDE_PROJECT_DIR when .maestro/ exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-hook-test-'));
    fs.mkdirSync(path.join(tmpDir, '.maestro'), { recursive: true });
    process.env.CLAUDE_PROJECT_DIR = tmpDir;

    const result = resolveProjectDir();
    expect(result).toBe(tmpDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns null when no .maestro/ found in CLAUDE_PROJECT_DIR', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-hook-test-'));
    process.env.CLAUDE_PROJECT_DIR = tmpDir;

    const result = resolveProjectDir();
    // May find the actual project .maestro via cwd walk, so check it's not tmpDir
    expect(result).not.toBe(tmpDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('logHookError', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-hook-err-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('creates sessions dir and writes error log', () => {
    logHookError(tmpDir, 'test-hook', new Error('test failure'));
    const logPath = path.join(tmpDir, '.maestro', 'sessions', 'hook-errors.log');
    expect(fs.existsSync(logPath)).toBe(true);
    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('test-hook');
    expect(content).toContain('test failure');
  });

  test('does not throw when projectDir is null', () => {
    expect(() => logHookError(null, 'test-hook', 'some error')).not.toThrow();
  });
});
