import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ensureDir } from '../../utils/fs-io.ts';
import { findProjectRoot, listFeatures } from '../../utils/detection.ts';
import { buildWorkerPrompt } from '../../utils/worker/prompt.ts';

describe('filesystem path length validation', () => {
  test('ensureDir rejects paths exceeding MAX_PATH', () => {
    const longPath = `/tmp/${'a'.repeat(250)}`;
    expect(() => ensureDir(longPath)).toThrow('Path exceeds maximum length');
  });

  test('ensureDir accepts paths within limit', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-path-'));
    try {
      const shortPath = path.join(tmpDir, 'valid');
      expect(() => ensureDir(shortPath)).not.toThrow();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('symlink resolution', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-symlink-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('findProjectRoot resolves symlinks to canonical path', () => {
    const realDir = path.join(tmpDir, 'real-project');
    fs.mkdirSync(path.join(realDir, '.maestro'), { recursive: true });

    const linkDir = path.join(tmpDir, 'link-project');
    fs.symlinkSync(realDir, linkDir);

    const fromReal = findProjectRoot(realDir);
    const fromLink = findProjectRoot(linkDir);
    expect(fromReal).toBe(fromLink);
  });
});

describe('case-insensitive feature collision', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-case-'));
    fs.mkdirSync(path.join(tmpDir, '.maestro', 'features', 'API-Auth'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('listFeatures returns existing features', () => {
    const features = listFeatures(tmpDir);
    expect(features).toContain('API-Auth');
  });
});

describe('worker prompt context drift warning', () => {
  const baseParams = {
    feature: 'my-feature',
    task: 'task-5',
    taskOrder: 5,
    workspacePath: '/tmp/project',
    plan: 'test plan',
    contextFiles: [],
    spec: 'do stuff',
  };

  test('includes context budget warning when tasks are dropped', () => {
    const prompt = buildWorkerPrompt({
      ...baseParams,
      droppedTaskCount: 5,
      droppedTasksHint: 'Dropped tasks: task-1, task-2, task-3, task-4, task-5',
    });
    expect(prompt).toContain('Context Budget Warning');
    expect(prompt).toContain('5 earlier completed task(s) were dropped');
    expect(prompt).toContain('Dropped tasks: task-1');
  });

  test('omits context budget warning when no tasks dropped', () => {
    const prompt = buildWorkerPrompt({
      ...baseParams,
      droppedTaskCount: 0,
    });
    expect(prompt).not.toContain('Context Budget Warning');
  });
});

describe('worker prompt direct-launch semantics', () => {
  const baseParams = {
    feature: 'feat',
    task: 'task-1',
    taskOrder: 1,
    workspacePath: '/tmp/project',
    plan: 'test plan',
    contextFiles: [],
    spec: 'do stuff',
  };

  test('uses task-finish instead of worktree commands', () => {
    const prompt = buildWorkerPrompt(baseParams);
    expect(prompt).toContain('maestro task-finish');
    expect(prompt).not.toContain('maestro worktree-commit');
    expect(prompt).not.toContain('maestro merge');
  });

  test('includes blocked continuation instructions', () => {
    const prompt = buildWorkerPrompt({
      ...baseParams,
      continueFrom: {
        status: 'blocked',
        previousSummary: 'Did the setup work.',
        decision: 'Use the fallback path.',
      },
    });
    expect(prompt).toContain('Continuation From Blocked State');
    expect(prompt).toContain('Use the fallback path.');
    expect(prompt).toContain('current files on disk');
  });

  test('includes partial continuation instructions', () => {
    const prompt = buildWorkerPrompt({
      ...baseParams,
      continueFrom: {
        status: 'partial',
        previousSummary: 'Half the work is done.',
      },
    });
    expect(prompt).toContain('Continuation From Partial State');
    expect(prompt).toContain('Half the work is done.');
  });

  test('includes summary grounding guidance', () => {
    const prompt = buildWorkerPrompt(baseParams);
    expect(prompt).toContain('Summary guidance');
    expect(prompt).toContain('Not verified');
    expect(prompt).toContain('Only state facts you directly observed');
  });
});
