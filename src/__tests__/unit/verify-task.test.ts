/**
 * Unit tests for verify-task usecase.
 * Tests state transitions: pass -> done, fail -> review, disabled -> direct done,
 * auto-accept types, memory extraction on failure, claimedAt passthrough.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { InMemoryTaskPort } from '../mocks/in-memory-task-port.ts';
import { verifyTask, type VerifyTaskOpts } from '../../usecases/verify-task.ts';
import type { VerificationPort, VerificationReport, VerifyParams } from '../../ports/verification.ts';
import type { ResolvedVerificationConfig } from '../../utils/verification-config.ts';
import { VERIFICATION_DEFAULTS } from '../../types.ts';

const FEATURE = 'test-feature';
const TASK = '01-setup';

/** Stub verification port that returns a configurable result. */
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

/** Minimal stub memory adapter for testing. */
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

/** Build opts with defaults. */
function makeOpts(
  taskPort: InMemoryTaskPort,
  vPort: VerificationPort,
  overrides: Partial<VerifyTaskOpts> = {},
): VerifyTaskOpts {
  return {
    taskPort, verificationPort: vPort,
    config: makeConfig(),
    projectRoot: '/tmp',
    featureName: FEATURE,
    taskFolder: TASK,
    summary: 'Done',
    ...overrides,
  };
}

describe('verifyTask', () => {
  let taskPort: InMemoryTaskPort;

  beforeEach(() => {
    taskPort = new InMemoryTaskPort();
    taskPort.seed(FEATURE, TASK, { status: 'claimed' });
  });

  test('pass -> done transition', async () => {
    const vPort = makeVerificationPort({ passed: true, score: 1 });
    const result = await verifyTask(makeOpts(taskPort, vPort, { summary: 'Implemented the thing' }));
    expect(result.newStatus).toBe('done');
    expect(result.report.passed).toBe(true);
    const task = await taskPort.get(FEATURE, TASK);
    expect(task?.status).toBe('done');
  });

  test('fail -> review (NOT revision -- usecase stops at review)', async () => {
    const vPort = makeVerificationPort({
      passed: false,
      score: 0.3,
      criteria: [{ name: 'build', passed: false, detail: 'Build failed' }],
      suggestions: ['Fix build'],
    });
    const result = await verifyTask(makeOpts(taskPort, vPort, { summary: 'Attempted impl' }));
    expect(result.newStatus).toBe('review');
    expect(result.report.passed).toBe(false);
    const task = await taskPort.get(FEATURE, TASK);
    expect(task?.status).toBe('review');
  });

  test('verification disabled -> direct done', async () => {
    const vPort = makeVerificationPort({ passed: false });
    const result = await verifyTask(makeOpts(taskPort, vPort, {
      config: makeConfig({ enabled: false }),
      summary: 'Done without checks',
    }));
    expect(result.newStatus).toBe('done');
    expect(result.report.passed).toBe(true);
    expect(result.report.criteria).toHaveLength(0);
    const task = await taskPort.get(FEATURE, TASK);
    expect(task?.status).toBe('done');
  });

  test('auto-accept types bypass verification', async () => {
    await taskPort.writeSpec(FEATURE, TASK, '## Task Type\ndocs\n');
    const vPort = makeVerificationPort({ passed: false });
    const result = await verifyTask(makeOpts(taskPort, vPort, {
      config: makeConfig({ autoAcceptTypes: ['docs'] }),
      summary: 'Updated docs',
    }));
    expect(result.newStatus).toBe('done');
    expect(result.report.passed).toBe(true);
  });

  test('writes memory on failure', async () => {
    const memAdapter = makeMemoryAdapter();
    const vPort = makeVerificationPort({
      passed: false,
      score: 0.25,
      criteria: [{ name: 'build', passed: false, detail: 'fail' }],
      suggestions: ['Fix it'],
    });
    await verifyTask(makeOpts(taskPort, vPort, {
      memoryAdapter: memAdapter,
      summary: 'Broken impl',
    }));
    expect(memAdapter.written).toHaveLength(1);
    expect(memAdapter.written[0].name).toContain('verification-fail');
    expect(memAdapter.written[0].content).toContain('build');
  });

  test('passes claimedAt to verification adapter', async () => {
    taskPort.seed(FEATURE, TASK, { status: 'pending' });
    await taskPort.claim(FEATURE, TASK, 'agent-1');
    const task = await taskPort.get(FEATURE, TASK);
    expect(task?.claimedAt).toBeTruthy();

    let capturedParams: VerifyParams | undefined;
    const vPort: VerificationPort = {
      async verify(params) {
        capturedParams = params;
        return { passed: true, score: 1, criteria: [], suggestions: [], timestamp: '' };
      },
    };

    await verifyTask(makeOpts(taskPort, vPort));
    expect(capturedParams?.claimedAt).toBe(task?.claimedAt);
  });

  test('writes verification report to task port', async () => {
    const vPort = makeVerificationPort({ passed: true, score: 1 });
    await verifyTask(makeOpts(taskPort, vPort));
    const report = await taskPort.readVerification(FEATURE, TASK);
    expect(report).toBeTruthy();
    expect(report?.passed).toBe(true);
  });
});
