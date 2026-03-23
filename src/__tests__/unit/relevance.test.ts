import { describe, test, expect } from 'bun:test';
import { scoreRelevance, extractKeywords } from '../../utils/relevance.ts';
import type { MemoryFileWithMeta, TaskInfo } from '../../core/types.ts';

function makeMemory(overrides: Partial<MemoryFileWithMeta> & { bodyContent?: string } = {}): MemoryFileWithMeta {
  return {
    name: 'test-memory',
    content: '',
    updatedAt: new Date().toISOString(),
    sizeBytes: 100,
    metadata: { tags: [], priority: 2, category: 'research' },
    bodyContent: 'Test memory content',
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
  return {
    folder: '01-setup-auth',
    name: 'Setup authentication module',
    status: 'claimed',
    origin: 'plan',
    ...overrides,
  };
}

describe('extractKeywords', () => {
  test('filters stopwords', () => {
    const words = extractKeywords('the auth module for this project');
    expect(words.has('auth')).toBe(true);
    expect(words.has('module')).toBe(true);
    expect(words.has('project')).toBe(true);
    expect(words.has('the')).toBe(false);
    expect(words.has('for')).toBe(false);
    expect(words.has('this')).toBe(false);
  });

  test('filters short words', () => {
    const words = extractKeywords('an api fix');
    // all < 4 chars
    expect(words.size).toBe(0);
  });

  test('splits on punctuation', () => {
    const words = extractKeywords('auth-module, setup_test');
    expect(words.has('auth')).toBe(true);
    expect(words.has('module')).toBe(true);
    expect(words.has('setup')).toBe(true);
    expect(words.has('test')).toBe(true);
  });
});

describe('scoreRelevance', () => {
  test('returns value between 0 and 1', () => {
    const score = scoreRelevance(makeMemory(), makeTask(), null);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  test('tag overlap: word-boundary match (not substring)', () => {
    const memory = makeMemory({ metadata: { tags: ['auth'], priority: 2, category: 'research' } });
    const taskWithAuth = makeTask({ folder: '01-setup-auth', name: 'Setup auth module' });
    const taskWithCoauthored = makeTask({ folder: '01-coauthored-doc', name: 'Write coauthored document' });

    const scoreAuth = scoreRelevance(memory, taskWithAuth, null);
    const scoreCoauth = scoreRelevance(memory, taskWithCoauthored, null);

    // auth tag should match "auth" in folder/name but NOT "coauthored"
    expect(scoreAuth).toBeGreaterThan(scoreCoauth);
  });

  test('architecture/decision categories score higher universally', () => {
    const archMemory = makeMemory({ metadata: { tags: [], priority: 2, category: 'architecture' } });
    const debugMemory = makeMemory({ metadata: { tags: [], priority: 2, category: 'debug' } });
    const task = makeTask();

    const archScore = scoreRelevance(archMemory, task, null);
    const debugScore = scoreRelevance(debugMemory, task, null);

    expect(archScore).toBeGreaterThan(debugScore);
  });

  test('debug category scores high for blocked tasks', () => {
    const debugMemory = makeMemory({ metadata: { tags: [], priority: 2, category: 'debug' } });
    const blockedTask = makeTask({ status: 'blocked' });
    const claimedTask = makeTask({ status: 'claimed' });

    const blockedScore = scoreRelevance(debugMemory, blockedTask, null);
    const claimedScore = scoreRelevance(debugMemory, claimedTask, null);

    expect(blockedScore).toBeGreaterThan(claimedScore);
  });

  test('priority 0 scores higher than priority 4', () => {
    const highPri = makeMemory({ metadata: { tags: [], priority: 0, category: 'research' } });
    const lowPri = makeMemory({ metadata: { tags: [], priority: 4, category: 'research' } });
    const task = makeTask();

    const highScore = scoreRelevance(highPri, task, null);
    const lowScore = scoreRelevance(lowPri, task, null);

    expect(highScore).toBeGreaterThan(lowScore);
  });

  test('keyword overlap boosts score', () => {
    const matchingMemory = makeMemory({
      bodyContent: 'Authentication setup using JWT tokens',
      name: 'auth-setup',
    });
    const unrelatedMemory = makeMemory({
      bodyContent: 'Database migration scripts for PostgreSQL',
      name: 'db-migration',
    });
    const task = makeTask({ name: 'Setup authentication module', folder: '01-setup-auth' });

    const matchScore = scoreRelevance(matchingMemory, task, null);
    const noMatchScore = scoreRelevance(unrelatedMemory, task, null);

    expect(matchScore).toBeGreaterThan(noMatchScore);
  });

  test('recency: newer memory scores higher', () => {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 3600000);
    const dayAgo = new Date(now.getTime() - 86400000);
    const featureCreated = new Date(now.getTime() - 86400000 * 7).toISOString();

    const newMemory = makeMemory({ updatedAt: hourAgo.toISOString() });
    const oldMemory = makeMemory({ updatedAt: dayAgo.toISOString() });
    const task = makeTask();

    const newScore = scoreRelevance(newMemory, task, null, featureCreated);
    const oldScore = scoreRelevance(oldMemory, task, null, featureCreated);

    expect(newScore).toBeGreaterThan(oldScore);
  });

  test('plan section contributes to matching', () => {
    const memory = makeMemory({
      metadata: { tags: ['database'], priority: 2, category: 'research' },
      bodyContent: 'Database connection pooling research',
      name: 'db-pooling',
    });
    const task = makeTask({ name: 'Implement feature' });

    const withSection = scoreRelevance(memory, task, '## Database Layer Setup');
    const withoutSection = scoreRelevance(memory, task, null);

    expect(withSection).toBeGreaterThan(withoutSection);
  });

  test('new feature (< 1 hour) does not cause extreme recency values', () => {
    const now = new Date();
    const featureCreated = new Date(now.getTime() - 60000).toISOString(); // 1 minute ago
    const memory = makeMemory({ updatedAt: now.toISOString() });
    const task = makeTask();

    const score = scoreRelevance(memory, task, null, featureCreated);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
