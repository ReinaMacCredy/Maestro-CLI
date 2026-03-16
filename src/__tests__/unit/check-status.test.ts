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
      memoryAdapter: {
        stats: () => ({ count: 0, totalBytes: 0 }),
      },
      directory: tmpDir,
    } as any;
  }

  test('returns status result with expected shape', async () => {
    const result = await checkStatus(services(), 'feat');
    expect(result.feature).toEqual({ name: 'feat', status: 'approved' });
    expect(result.plan.exists).toBe(true);
    expect(result.plan.approved).toBe(true);
    expect(typeof result.tasks.total).toBe('number');
    expect(Array.isArray(result.runnable)).toBe(true);
    expect(Array.isArray(result.blocked)).toBe(true);
    expect(typeof result.nextAction).toBe('string');
  });

  test('blocked is a string array of blocked task folders', async () => {
    taskPort.seed('feat', '02-blocked', { status: 'blocked' });

    const result = await checkStatus(services(), 'feat');
    expect(result.blocked).toContain('02-blocked');
    expect(Array.isArray(result.blocked)).toBe(true);
  });

  test('inProgress counts claimed status tasks', async () => {
    taskPort.seed('feat', '03-claimed', { status: 'claimed' });

    const result = await checkStatus(services(), 'feat');
    expect(result.tasks.inProgress).toBeGreaterThanOrEqual(1);
  });

  test('does not include zombies field in result', async () => {
    const result = await checkStatus(services(), 'feat');
    expect((result as any).zombies).toBeUndefined();
  });
});
