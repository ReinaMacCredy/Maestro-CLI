import { describe, test, expect } from 'bun:test';
import { doctor, type DoctorServices } from '../../usecases/doctor';

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
    graphPort: undefined,
    handoffPort: undefined,
    searchPort: undefined,
    doctrinePort: undefined,
    ...overrides,
  };
}

describe('doctor use case', () => {
  test('returns ok checks when everything is healthy', async () => {
    const services = makeMockServices({
      graphPort: {} as DoctorServices['graphPort'],
      searchPort: {} as DoctorServices['searchPort'],
    });
    const report = await doctor(services);

    expect(report.checks.length).toBeGreaterThanOrEqual(7);
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

  test('reports integration availability correctly', async () => {
    const services = makeMockServices({
      graphPort: {} as DoctorServices['graphPort'],
      doctrinePort: {} as DoctorServices['doctrinePort'],
    });
    const report = await doctor(services);

    const graphCheck = report.checks.find((c) => c.name === 'graph (bv)');
    expect(graphCheck?.status).toBe('ok');

    const handoffCheck = report.checks.find((c) => c.name === 'handoff (agent-mail)');
    expect(handoffCheck?.status).toBe('warn');

    const doctrineCheck = report.checks.find((c) => c.name === 'doctrine');
    expect(doctrineCheck?.status).toBe('ok');
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
