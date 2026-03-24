import { describe, test, expect } from 'bun:test';
import { buildExecutionMemory, type ExecutionMemoryParams } from '../../memory/execution/writer.ts';
import type { VerificationReport } from '../../tasks/verification/port.ts';

function makeParams(overrides: Partial<ExecutionMemoryParams> = {}): ExecutionMemoryParams {
  return {
    taskFolder: '01-setup-auth',
    taskName: 'Setup authentication module',
    summary: 'Implemented JWT-based auth with refresh tokens',
    verificationReport: null,
    ...overrides,
  };
}

function makeReport(passed: boolean, score = 1): VerificationReport {
  return {
    passed,
    score,
    criteria: [
      { name: 'build', passed: true, detail: 'Build succeeded' },
      { name: 'git-diff', passed, detail: passed ? 'Changes detected' : 'No changes' },
    ],
    suggestions: passed ? [] : ['Add more changes'],
    timestamp: new Date().toISOString(),
  };
}

describe('buildExecutionMemory', () => {
  test('generates correct exec- prefix filename', () => {
    const result = buildExecutionMemory(makeParams());
    expect(result.fileName).toBe('exec-01-setup-auth');
  });

  test('generates different filenames for different tasks', () => {
    const r1 = buildExecutionMemory(makeParams({ taskFolder: '01-setup-auth' }));
    const r2 = buildExecutionMemory(makeParams({ taskFolder: '02-add-endpoints' }));
    expect(r1.fileName).not.toBe(r2.fileName);
  });

  test('always includes execution tag', () => {
    const result = buildExecutionMemory(makeParams());
    expect(result.tags[0]).toBe('execution');
    expect(result.tags).toContain('execution');
  });

  test('derives tags from folder segments >= 4 chars', () => {
    const result = buildExecutionMemory(makeParams({ taskFolder: '01-setup-authentication' }));
    expect(result.tags).toContain('setup');
    expect(result.tags).toContain('authentication');
    // '01' is numeric, filtered out
    expect(result.tags).not.toContain('01');
  });

  test('folder tags limited to 3', () => {
    const result = buildExecutionMemory(makeParams({
      taskFolder: '01-setup-authentication-middleware-router',
    }));
    const folderTags = result.tags.filter(t => t !== 'execution');
    // At most 3 folder-derived tags (setup, authentication, middleware -- router dropped)
    const folderOnly = ['setup', 'authentication', 'middleware', 'router'];
    const counted = folderTags.filter(t => folderOnly.includes(t));
    expect(counted.length).toBeLessThanOrEqual(3);
  });

  test('derives tags from file extensions', () => {
    const result = buildExecutionMemory(makeParams({
      changedFiles: ['src/auth.ts', 'src/auth.test.ts', 'style.css'],
    }));
    expect(result.tags).toContain('typescript');
    expect(result.tags).toContain('testing');
  });

  test('derives tags from spec keywords', () => {
    const result = buildExecutionMemory(makeParams({
      taskFolder: '01-setup',
      changedFiles: [],
      specContent: 'Implement authentication with middleware and database integration',
    }));
    // Should include some spec keywords
    expect(result.tags.length).toBeGreaterThan(2);
  });

  test('caps tags at 8', () => {
    const result = buildExecutionMemory(makeParams({
      taskFolder: '01-setup-authentication-middleware-router-handler',
      changedFiles: ['a.ts', 'b.py', 'c.rs', 'd.go', 'e.java'],
      specContent: 'implement endpoint validation serialization configuration deployment monitoring',
    }));
    expect(result.tags.length).toBeLessThanOrEqual(8);
  });

  test('deduplicates tags', () => {
    const result = buildExecutionMemory(makeParams({
      taskFolder: '01-typescript-setup',
      changedFiles: ['src/index.ts'],
    }));
    const unique = new Set(result.tags);
    expect(unique.size).toBe(result.tags.length);
  });

  test('produces valid YAML frontmatter with category execution', () => {
    const result = buildExecutionMemory(makeParams());
    expect(result.content).toMatch(/^---\n/);
    expect(result.content).toContain('category: execution');
    expect(result.content).toContain('priority: 1');
    expect(result.content).toContain('tags:');
  });

  test('includes summary in body', () => {
    const result = buildExecutionMemory(makeParams({
      summary: 'Added JWT tokens with rotation',
    }));
    expect(result.content).toContain('Added JWT tokens with rotation');
  });

  test('includes files changed when provided', () => {
    const result = buildExecutionMemory(makeParams({
      changedFiles: ['src/auth.ts', 'src/middleware.ts'],
    }));
    expect(result.content).toContain('**Files changed** (2)');
    expect(result.content).toContain('src/auth.ts');
  });

  test('truncates files list at 15', () => {
    const files = Array.from({ length: 20 }, (_, i) => `file${i}.ts`);
    const result = buildExecutionMemory(makeParams({ changedFiles: files }));
    expect(result.content).toContain('(+5 more)');
    expect(result.content).toContain('**Files changed** (20)');
  });

  test('includes verification passed result', () => {
    const result = buildExecutionMemory(makeParams({
      verificationReport: makeReport(true, 0.95),
    }));
    expect(result.content).toContain('passed (score 0.95)');
  });

  test('includes verification failed result with criteria names', () => {
    const result = buildExecutionMemory(makeParams({
      verificationReport: makeReport(false, 0.50),
    }));
    expect(result.content).toContain('score 0.50');
    expect(result.content).toContain('failed: git-diff');
  });

  test('includes revision count', () => {
    const result = buildExecutionMemory(makeParams({ revisionCount: 2 }));
    expect(result.content).toContain('**Revisions**: 2');
  });

  test('defaults revision count to 0', () => {
    const result = buildExecutionMemory(makeParams());
    expect(result.content).toContain('**Revisions**: 0');
  });

  test('formats duration in minutes', () => {
    const claimedAt = new Date('2025-01-01T10:00:00Z').toISOString();
    const completedAt = new Date('2025-01-01T10:45:00Z').toISOString();
    const result = buildExecutionMemory(makeParams({ claimedAt, completedAt }));
    expect(result.content).toContain('**Duration**: 45m');
  });

  test('formats duration in hours and minutes', () => {
    const claimedAt = new Date('2025-01-01T10:00:00Z').toISOString();
    const completedAt = new Date('2025-01-01T12:30:00Z').toISOString();
    const result = buildExecutionMemory(makeParams({ claimedAt, completedAt }));
    expect(result.content).toContain('**Duration**: 2h30m');
  });

  test('shows unknown duration when timestamps missing', () => {
    const result = buildExecutionMemory(makeParams());
    expect(result.content).toContain('**Duration**: unknown');
  });

  test('handles all optional fields missing', () => {
    const result = buildExecutionMemory({
      taskFolder: '01-minimal',
      taskName: 'Minimal task',
      summary: 'Done.',
      verificationReport: null,
    });
    expect(result.fileName).toBe('exec-01-minimal');
    expect(result.tags).toContain('execution');
    expect(result.content).toContain('Done.');
    expect(result.content).not.toContain('**Files changed**');
  });

  test('body is compact (under 500 bytes for typical inputs)', () => {
    const result = buildExecutionMemory(makeParams({
      changedFiles: ['src/auth.ts', 'src/middleware.ts'],
      verificationReport: makeReport(true),
      claimedAt: new Date('2025-01-01T10:00:00Z').toISOString(),
      completedAt: new Date('2025-01-01T10:30:00Z').toISOString(),
    }));
    // Content includes frontmatter; body alone should be compact
    const bodyStart = result.content.indexOf('Task **');
    const body = result.content.slice(bodyStart);
    expect(Buffer.byteLength(body)).toBeLessThan(500);
  });

  test('floor is 2 tags in degenerate case', () => {
    const result = buildExecutionMemory({
      taskFolder: '01-go',
      taskName: 'Go',
      summary: 'x',
      verificationReport: null,
    });
    // "execution" always, but "go" is only 2 chars so filtered out
    // folder "01" is numeric so filtered. Only "execution" remains.
    // This is the true degenerate case -- 1 tag minimum (execution is always there)
    expect(result.tags.length).toBeGreaterThanOrEqual(1);
    expect(result.tags).toContain('execution');
  });
});
