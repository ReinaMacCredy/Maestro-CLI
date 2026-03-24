import { describe, test, expect, beforeEach } from 'bun:test';
import { doctor, type DoctorServices } from '../../workflow/doctor.ts';
import { ToolboxRegistry } from '../../toolbox/registry.ts';
import { clearDetectCache } from '../../toolbox/loader.ts';
import { DEFAULT_SETTINGS } from '../../core/settings.ts';
import type { ToolManifest } from '../../toolbox/types.ts';

function makeManifest(overrides: Partial<ToolManifest> & { name: string }): ToolManifest {
  return { binary: null, detect: null, provides: null, priority: 0, adapter: 'test.ts', ...overrides };
}

function makeToolbox(manifests?: ToolManifest[]): ToolboxRegistry {
  return new ToolboxRegistry(
    manifests ?? [
      makeManifest({ name: 'fs-tasks', provides: 'tasks', priority: 0 }),
      makeManifest({ name: 'bv', provides: 'graph', priority: 100, detect: 'echo ok' }),
      makeManifest({ name: 'cass', provides: 'search', priority: 100, detect: 'echo ok' }),
      makeManifest({ name: 'agent-mail', provides: 'handoff', priority: 100 }),
    ],
    DEFAULT_SETTINGS,
  );
}

function makeMockServices(overrides: Partial<DoctorServices> = {}): DoctorServices {
  return {
    configAdapter: { get: () => ({}) } as DoctorServices['configAdapter'],
    featureAdapter: {
      getActive: () => ({ name: 'test-feature', status: 'executing', createdAt: '2026-01-01' }),
    } as unknown as DoctorServices['featureAdapter'],
    taskPort: {
      list: async () => [],
    } as unknown as DoctorServices['taskPort'],
    directory: '/tmp/test',
    toolbox: makeToolbox(),
    agentToolsRegistry: { getAll: () => [], getInstalled: () => [], isAvailable: () => false } as any,
    taskBackend: 'fs',
    graphPort: undefined,
    handoffPort: undefined,
    searchPort: undefined,
    doctrinePort: undefined,
    ...overrides,
  };
}

describe('doctor use case', () => {
  beforeEach(() => {
    clearDetectCache();
  });

  test('returns ok checks when everything is healthy', async () => {
    const services = makeMockServices();
    const report = await doctor(services);

    expect(report.checks.length).toBeGreaterThanOrEqual(5);
    expect(report.summary.fail).toBe(0);

    const configCheck = report.checks.find((c) => c.name === 'config');
    expect(configCheck?.status).toBe('ok');

    const featureCheck = report.checks.find((c) => c.name === 'active-feature');
    expect(featureCheck?.status).toBe('ok');
    expect(featureCheck?.message).toContain('test-feature');
  });

  test('warns when no active feature', async () => {
    const services = makeMockServices({
      featureAdapter: {
        getActive: () => null,
      } as unknown as DoctorServices['featureAdapter'],
    });
    const report = await doctor(services);

    const featureCheck = report.checks.find((c) => c.name === 'active-feature');
    expect(featureCheck?.status).toBe('warn');

    const taskCheck = report.checks.find((c) => c.name === 'task-backend');
    expect(taskCheck?.status).toBe('warn');
  });

  test('fails when config throws', async () => {
    const services = makeMockServices({
      configAdapter: {
        get: () => { throw new Error('bad config'); },
      } as unknown as DoctorServices['configAdapter'],
    });
    const report = await doctor(services);

    const configCheck = report.checks.find((c) => c.name === 'config');
    expect(configCheck?.status).toBe('fail');
    expect(report.summary.fail).toBeGreaterThanOrEqual(1);
  });

  test('reports toolbox status for integrations', async () => {
    const services = makeMockServices();
    const report = await doctor(services);

    // bv and cass are detected (detect: 'echo ok'), agent-mail is built-in
    const bvCheck = report.checks.find((c) => c.name.includes('bv'));
    expect(bvCheck?.status).toBe('ok');

    const cassCheck = report.checks.find((c) => c.name.includes('cass'));
    expect(cassCheck?.status).toBe('ok');

    const amCheck = report.checks.find((c) => c.name.includes('agent-mail'));
    expect(amCheck?.status).toBe('ok');
  });

  test('reports denied tools as warn', async () => {
    const toolbox = new ToolboxRegistry(
      [
        makeManifest({ name: 'fs-tasks', provides: 'tasks', priority: 0 }),
        makeManifest({ name: 'bv', provides: 'graph', priority: 100, detect: 'echo ok' }),
      ],
      { ...DEFAULT_SETTINGS, toolbox: { allow: [], deny: ['bv'], config: {} } },
    );
    const services = makeMockServices({ toolbox });
    const report = await doctor(services);

    const bvCheck = report.checks.find((c) => c.name.includes('bv'));
    expect(bvCheck?.status).toBe('warn');
    expect(bvCheck?.message).toContain('Denied');
  });

  test('summary counts match checks', async () => {
    const services = makeMockServices();
    const report = await doctor(services);

    const counted = report.checks.reduce(
      (acc, c) => { acc[c.status]++; return acc; },
      { ok: 0, warn: 0, fail: 0 },
    );
    expect(report.summary).toEqual(counted);
  });
});
