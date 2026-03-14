import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';
import { setOutputMode } from '../../lib/output.ts';
import { startTask } from '../../usecases/start-task.ts';
import { readTaskSession, writeTaskSession } from '../../utils/task-session.ts';

describe('startTask', () => {
  let tmpDir: string;
  let taskPort: InMemoryTaskPort;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-start-task-'));
    fs.mkdirSync(path.join(tmpDir, '.maestro', 'features'), { recursive: true });
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'ignore' });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), 'hello\n');
    execSync('git add .', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git commit -m "init"', { cwd: tmpDir, stdio: 'ignore' });

    taskPort = new InMemoryTaskPort();
    taskPort.seed('feat', '01-task', { status: 'pending' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function services(overrides: Record<string, unknown> = {}) {
    return {
      taskPort,
      featureAdapter: {
        requireActive: () => {},
      },
      planAdapter: {
        read: () => ({ content: '## Plan\n\nDo the work.', status: 'approved', comments: [] }),
      },
      contextAdapter: {
        list: () => [],
      },
      configAdapter: {
        get: () => ({
          workerCli: 'codex',
          workerCliArgs: [],
          staleTaskThresholdMinutes: 120,
        }),
      },
      workerRunner: {
        launch: () => ({
          child: spawn(process.execPath, ['-e', 'process.exit(0)'], {
            cwd: tmpDir,
            stdio: 'pipe',
          }),
        }),
      },
      directory: tmpDir,
      ...overrides,
    } as any;
  }

  test('auto-fails when the worker exits without calling task-finish', async () => {
    const result = await startTask(services(), {
      feature: 'feat',
      task: '01-task',
    });

    const task = await taskPort.get('feat', '01-task');
    const session = readTaskSession(tmpDir, 'feat', '01-task');
    const report = await taskPort.readReport('feat', '01-task');

    expect(result.finalStatus).toBe('failed');
    expect(task?.status).toBe('failed');
    expect(session?.launcher).toBe('codex');
    expect(report).toContain('exited cleanly without calling task-finish');
  });

  test('treats in_progress tasks with missing session.json as stale', async () => {
    taskPort.setStatus('feat', '01-task', 'in_progress');
    await taskPort.update('feat', '01-task', {
      startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      baseCommit: 'abc123',
    });

    await expect(
      startTask(services(), {
        feature: 'feat',
        task: '01-task',
      }),
    ).rejects.toThrow("appears stale");
  });

  test('does not treat manually managed in_progress tasks as stale', async () => {
    taskPort.setStatus('feat', '01-task', 'in_progress');

    await expect(
      startTask(services(), {
        feature: 'feat',
        task: '01-task',
      }),
    ).rejects.toThrow("already in progress");
  });

  test('uses piped stdio when running without an interactive terminal', async () => {
    setOutputMode('text');
    const originalStdinTTY = process.stdin.isTTY;
    const originalStdoutTTY = process.stdout.isTTY;
    const originalStderrTTY = process.stderr.isTTY;
    let observedStdio: unknown;

    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false });
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: false });
    Object.defineProperty(process.stderr, 'isTTY', { configurable: true, value: false });

    try {
      await startTask(services({
        workerRunner: {
          launch: (request: { stdio?: unknown }) => {
            observedStdio = request.stdio;
            return {
              child: spawn(process.execPath, ['-e', 'process.exit(0)'], {
                cwd: tmpDir,
                stdio: 'ignore',
              }),
            };
          },
        },
      }), {
        feature: 'feat',
        task: '01-task',
      });
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: originalStdinTTY });
      Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: originalStdoutTTY });
      Object.defineProperty(process.stderr, 'isTTY', { configurable: true, value: originalStderrTTY });
    }

    expect(observedStdio).toEqual(['ignore', 'pipe', 'pipe']);
  });

  test('refuses force recovery while the recorded stale worker pid is still alive', async () => {
    const originalKill = process.kill;
    const staleTimestamp = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    taskPort.setStatus('feat', '01-task', 'in_progress');
    writeTaskSession(tmpDir, 'feat', '01-task', {
      taskId: '01-task',
      sessionId: 'session-1',
      launcher: 'codex',
      attempt: 1,
      pid: 4242,
      startedAt: staleTimestamp,
      lastHeartbeatAt: staleTimestamp,
      workerPromptPath: '.maestro/features/feat/tasks/01-task/worker-prompt.md',
    });

    (process as typeof process & { kill: typeof process.kill }).kill = ((pid: number, signal?: number | NodeJS.Signals) => {
      if (pid === 4242 && signal === 0) {
        return true;
      }
      return originalKill(pid, signal as NodeJS.Signals);
    }) as typeof process.kill;

    try {
      await expect(
        startTask(services(), {
          feature: 'feat',
          task: '01-task',
          force: true,
        }),
      ).rejects.toThrow('still has a live worker process');
    } finally {
      (process as typeof process & { kill: typeof process.kill }).kill = originalKill;
    }
  });
});
