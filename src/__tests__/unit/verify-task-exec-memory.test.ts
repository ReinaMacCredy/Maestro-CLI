/**
 * Tests for execution memory auto-generation in verifyTask.
 * Verifies that execution memories are written on done transitions
 * and NOT written on review transitions.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';
import { verifyTask, type VerifyTaskOpts } from '../../usecases/verify-task.ts';
import type { VerificationPort, VerificationReport, VerifyParams } from '../../tasks/verification/port.ts';
import type { ResolvedVerificationConfig } from '../../utils/verification-config.ts';
import { VERIFICATION_DEFAULTS } from '../../core/types.ts';

const FEATURE = 'test-feature';
const TASK = '01-setup-auth';

function makeVerificationPort(overrides: Partial<VerificationReport> = {}): VerificationPort {
  return {
    async verify(_params: VerifyParams): Promise<VerificationReport> {
      return {
        passed: true,
        score: 1,
        criteria: [{ name: 'build', passed: true, detail: 'ok' }],
        suggestions: [],
        timestamp: new Date().toISOString(),
        ...overrides,
      };
    },
  };
}

function makeConfig(overrides: Partial<ResolvedVerificationConfig> = {}): ResolvedVerificationConfig {
  return { ...VERIFICATION_DEFAULTS, ...overrides };
}

function makeMemoryAdapter() {
  const written: Array<{ feature: string; name: string; content: string }> = [];
  return {
    written,
    write(feature: string, name: string, content: string) {
      written.push({ feature, name, content });
      return name;
    },
    read() { return null; },
    list() { return []; },
    listWithMeta() { return []; },
    delete() { return false; },
    compile() { return ''; },
    archive() { return { archived: [], archivePath: '' }; },
    stats() { return { count: 0, totalBytes: 0 }; },
    writeGlobal() { return ''; },
    readGlobal() { return null; },
    listGlobal() { return []; },
    deleteGlobal() { return false; },
  };
}

describe('verifyTask execution memory', () => {
  let taskPort: InMemoryTaskPort;
  let mem: ReturnType<typeof makeMemoryAdapter>;

  beforeEach(() => {
    taskPort = new InMemoryTaskPort();
    taskPort.seed(FEATURE, TASK, { status: 'claimed', claimedAt: new Date().toISOString() });
    mem = makeMemoryAdapter();
  });

  test('writes execution memory when verification disabled', async () => {
    const result = await verifyTask({
      taskPort, verificationPort: makeVerificationPort(), memoryAdapter: mem,
      config: makeConfig({ enabled: false }),
      projectRoot: '/tmp', featureName: FEATURE, taskFolder: TASK,
      summary: 'Implemented auth module',
    });
    expect(result.newStatus).toBe('done');

    const execMem = mem.written.find(w => w.name.startsWith('exec-'));
    expect(execMem).toBeDefined();
    expect(execMem!.name).toBe('exec-01-setup-auth');
    expect(execMem!.content).toContain('category: execution');
    expect(execMem!.content).toContain('Implemented auth module');
  });

  test('writes execution memory when verification passes', async () => {
    const result = await verifyTask({
      taskPort, verificationPort: makeVerificationPort({ passed: true, score: 0.9 }),
      memoryAdapter: mem, config: makeConfig({ enabled: true }),
      projectRoot: '/tmp', featureName: FEATURE, taskFolder: TASK,
      summary: 'Done',
    });
    expect(result.newStatus).toBe('done');

    const execMem = mem.written.find(w => w.name.startsWith('exec-'));
    expect(execMem).toBeDefined();
    expect(execMem!.name).toBe('exec-01-setup-auth');
  });

  test('does NOT write execution memory when verification fails (review)', async () => {
    const result = await verifyTask({
      taskPort,
      verificationPort: makeVerificationPort({
        passed: false, score: 0.3,
        criteria: [{ name: 'build', passed: false, detail: 'Build failed' }],
        suggestions: ['Fix build'],
      }),
      memoryAdapter: mem, config: makeConfig({ enabled: true }),
      projectRoot: '/tmp', featureName: FEATURE, taskFolder: TASK,
      summary: 'Done',
    });
    expect(result.newStatus).toBe('review');

    const execMem = mem.written.find(w => w.name.startsWith('exec-'));
    expect(execMem).toBeUndefined();

    // Verification failure memory SHOULD be written
    const failMem = mem.written.find(w => w.name.startsWith('verification-fail-'));
    expect(failMem).toBeDefined();
  });

  test('does not crash when memoryAdapter is undefined', async () => {
    const result = await verifyTask({
      taskPort, verificationPort: makeVerificationPort(),
      memoryAdapter: undefined, config: makeConfig({ enabled: false }),
      projectRoot: '/tmp', featureName: FEATURE, taskFolder: TASK,
      summary: 'Done',
    });
    expect(result.newStatus).toBe('done');
  });

  test('execution memory filename matches task folder', async () => {
    const customTask = '03-database-migration';
    taskPort.seed(FEATURE, customTask, { status: 'claimed' });
    const result = await verifyTask({
      taskPort, verificationPort: makeVerificationPort(),
      memoryAdapter: mem, config: makeConfig({ enabled: false }),
      projectRoot: '/tmp', featureName: FEATURE, taskFolder: customTask,
      summary: 'Migrated DB',
    });
    expect(result.newStatus).toBe('done');

    const execMem = mem.written.find(w => w.name.startsWith('exec-'));
    expect(execMem).toBeDefined();
    expect(execMem!.name).toBe('exec-03-database-migration');
  });

  test('execution memory is written to the correct feature', async () => {
    const myFeature = 'my-feature';
    taskPort.seed(myFeature, TASK, { status: 'claimed' });
    await verifyTask({
      taskPort, verificationPort: makeVerificationPort(),
      memoryAdapter: mem, config: makeConfig({ enabled: false }),
      projectRoot: '/tmp', featureName: myFeature, taskFolder: TASK,
      summary: 'Done',
    });

    const execMem = mem.written.find(w => w.name.startsWith('exec-'));
    expect(execMem).toBeDefined();
    expect(execMem!.feature).toBe('my-feature');
  });
});
