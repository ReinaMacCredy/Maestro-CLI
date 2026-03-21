import { describe, test, expect } from 'bun:test';
import { parseExecMemory } from '../../utils/parse-exec-memory.ts';
import { buildExecutionMemory } from '../../utils/execution-memory.ts';
import type { VerificationReport } from '../../ports/verification.ts';

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

describe('parseExecMemory', () => {
  test('round-trips fields from buildExecutionMemory output', () => {
    const result = buildExecutionMemory({
      taskFolder: '01-setup-auth',
      taskName: 'Setup auth',
      summary: 'Implemented JWT auth',
      verificationReport: makeReport(true, 0.95),
      claimedAt: '2025-01-01T00:00:00Z',
      completedAt: '2025-01-01T01:30:00Z',
      revisionCount: 2,
      changedFiles: ['src/auth.ts', 'src/auth.test.ts'],
    });

    const parsed = parseExecMemory(result.content);

    expect(parsed.summary).toBe('Implemented JWT auth');
    expect(parsed.filesChanged).toBe(2);
    expect(parsed.verificationPassed).toBe(true);
    expect(parsed.revisionCount).toBe(2);
    expect(parsed.duration).toBe('1h30m');
    expect(parsed.tags).toContain('execution');
  });

  test('defaults revisionCount to 0 when missing', () => {
    const content = `---
tags: [execution]
category: execution
priority: 1
---
Task **01-test** completed.

**Summary**: Did stuff`;

    const parsed = parseExecMemory(content);
    expect(parsed.revisionCount).toBe(0);
    expect(parsed.duration).toBeUndefined();
  });

  test('returns undefined duration for "unknown"', () => {
    const result = buildExecutionMemory({
      taskFolder: '01-test',
      taskName: 'Test',
      summary: 'Test task',
      verificationReport: null,
      // no claimedAt/completedAt -> duration = "unknown"
    });

    const parsed = parseExecMemory(result.content);
    expect(parsed.duration).toBeUndefined();
  });

  test('parses verification failed state', () => {
    const result = buildExecutionMemory({
      taskFolder: '02-api',
      taskName: 'API endpoint',
      summary: 'Added endpoint',
      verificationReport: makeReport(false, 0.5),
      changedFiles: ['src/api.ts'],
    });

    const parsed = parseExecMemory(result.content);
    expect(parsed.verificationPassed).toBe(false);
  });

  test('handles empty content gracefully', () => {
    const parsed = parseExecMemory('');
    expect(parsed.summary).toBe('');
    expect(parsed.filesChanged).toBe(0);
    expect(parsed.verificationPassed).toBe(false);
    expect(parsed.revisionCount).toBe(0);
    expect(parsed.duration).toBeUndefined();
    expect(parsed.tags).toEqual([]);
  });

  test('handles content without frontmatter', () => {
    const content = '**Summary**: Just a summary\n**Revisions**: 3 | **Duration**: 45m';
    const parsed = parseExecMemory(content);
    expect(parsed.summary).toBe('Just a summary');
    expect(parsed.revisionCount).toBe(3);
    expect(parsed.duration).toBe('45m');
    expect(parsed.tags).toEqual([]);
  });
});
