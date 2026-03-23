import { describe, test, expect } from 'bun:test';
import { history, type HistoryServices } from '../../usecases/history';

function makeMockServices(overrides: Partial<HistoryServices> = {}): HistoryServices {
  return {
    featureAdapter: {
      list: () => ['feature-a', 'feature-b', 'feature-c'],
      get: (name: string) => {
        const features: Record<string, unknown> = {
          'feature-a': { name: 'feature-a', status: 'completed', createdAt: '2026-03-01T00:00:00Z', completedAt: '2026-03-05T00:00:00Z' },
          'feature-b': { name: 'feature-b', status: 'executing', createdAt: '2026-03-10T00:00:00Z' },
          'feature-c': { name: 'feature-c', status: 'completed', createdAt: '2026-03-15T00:00:00Z', completedAt: '2026-03-18T00:00:00Z' },
        };
        return features[name] ?? null;
      },
    } as unknown as HistoryServices['featureAdapter'],
    taskPort: {
      list: async (feature: string) => {
        if (feature === 'feature-a') return [{ status: 'done' }, { status: 'done' }];
        if (feature === 'feature-c') return [{ status: 'done' }, { status: 'blocked' }, { status: 'done' }];
        return [];
      },
    } as unknown as HistoryServices['taskPort'],
    ...overrides,
  };
}

describe('history use case', () => {
  test('returns features sorted by most recent first', async () => {
    const result = await history(makeMockServices());

    expect(result.features.length).toBe(3);
    expect(result.features[0].name).toBe('feature-c');
    expect(result.features[1].name).toBe('feature-b');
    expect(result.features[2].name).toBe('feature-a');
  });

  test('computes duration for completed features', async () => {
    const result = await history(makeMockServices());

    const featureA = result.features.find((f) => f.name === 'feature-a');
    expect(featureA?.durationDays).toBe(4);

    const featureB = result.features.find((f) => f.name === 'feature-b');
    expect(featureB?.durationDays).toBeUndefined();
  });

  test('computes task stats', async () => {
    const result = await history(makeMockServices());

    const featureC = result.features.find((f) => f.name === 'feature-c');
    expect(featureC?.taskStats).toEqual({ total: 3, done: 2, blocked: 1 });
  });

  test('respects limit option', async () => {
    const result = await history(makeMockServices(), { limit: 2 });

    expect(result.features.length).toBe(2);
    expect(result.total).toBe(3);
  });

  test('filters by status', async () => {
    const result = await history(makeMockServices(), { status: 'completed' });

    expect(result.features.length).toBe(2);
    expect(result.features.every((f) => f.status === 'completed')).toBe(true);
  });

  test('handles empty feature list', async () => {
    const services = makeMockServices({
      featureAdapter: {
        list: () => [],
        get: () => null,
      } as unknown as HistoryServices['featureAdapter'],
    });
    const result = await history(services);

    expect(result.features).toEqual([]);
    expect(result.total).toBe(0);
  });
});
