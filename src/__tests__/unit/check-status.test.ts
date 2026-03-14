import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';
import { checkStatus } from '../../usecases/check-status.ts';

describe('checkStatus', () => {
  let tmpDir: string;
  let taskPort: InMemoryTaskPort;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-check-status-'));
    fs.mkdirSync(path.join(tmpDir, '.maestro', 'features', 'feat', 'tasks', '01-task'), {
      recursive: true,
    });

    taskPort = new InMemoryTaskPort();
    taskPort.seed('feat', '01-task', { status: 'in_progress' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function services() {
    return {
      taskPort,
      featureAdapter: {
        get: () => ({
          name: 'feat',
          status: 'approved',
          createdAt: new Date().toISOString(),
        }),
      },
      planAdapter: {
        read: () => ({ content: '## Plan', status: 'approved', comments: [] }),
      },
      contextAdapter: {
        stats: () => ({ count: 0, totalBytes: 0 }),
      },
      configAdapter: {
        get: () => ({ staleTaskThresholdMinutes: 120 }),
      },
      directory: tmpDir,
    } as any;
  }

  test('does not flag manual in_progress tasks without worker metadata as stale', async () => {
    const result = await checkStatus(services(), 'feat');
    expect(result.zombies).toEqual([]);
  });

  test('flags worker-managed in_progress tasks with missing session as stale', async () => {
    await taskPort.update('feat', '01-task', {
      startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      baseCommit: 'abc123',
    });

    const result = await checkStatus(services(), 'feat');
    expect(result.zombies).toEqual(['01-task']);
    expect(result.nextAction).toContain('task-start');
    expect(result.nextAction).toContain('--force');
  });
});
