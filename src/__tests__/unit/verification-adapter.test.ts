/**
 * Unit tests for FsVerificationAdapter.
 * Tests: build command detection, individual criteria, scoring, AC matching.
 */

import { describe, test, expect } from 'bun:test';
import { FsVerificationAdapter } from '../../tasks/verification/adapter.ts';
import { VERIFICATION_DEFAULTS } from '../../core/types.ts';
import type { ResolvedVerificationConfig } from '../../tasks/verification/config.ts';

function makeConfig(overrides: Partial<ResolvedVerificationConfig> = {}): ResolvedVerificationConfig {
  return { ...VERIFICATION_DEFAULTS, ...overrides };
}

describe('FsVerificationAdapter', () => {
  describe('summary quality criterion', () => {
    test('fails for short summary', async () => {
      const adapter = new FsVerificationAdapter(makeConfig({ buildCommand: 'true' }));
      const report = await adapter.verify({
        projectRoot: '/tmp',
        featureName: 'f',
        taskFolder: 't',
        summary: 'ok',
      });
      const summaryCheck = report.criteria.find(c => c.name === 'summary-quality');
      expect(summaryCheck?.passed).toBe(false);
      expect(summaryCheck?.detail).toContain('too short');
    });

    test('passes for adequate summary with spec terms', async () => {
      const adapter = new FsVerificationAdapter(makeConfig({ buildCommand: 'true' }));
      const report = await adapter.verify({
        projectRoot: '/tmp',
        featureName: 'f',
        taskFolder: 't',
        summary: 'Implemented the database schema with proper migrations and indexes',
        specContent: 'Create database schema with migrations',
      });
      const summaryCheck = report.criteria.find(c => c.name === 'summary-quality');
      expect(summaryCheck?.passed).toBe(true);
    });

    test('fails when summary has no spec term overlap', async () => {
      const adapter = new FsVerificationAdapter(makeConfig({ buildCommand: 'true' }));
      const report = await adapter.verify({
        projectRoot: '/tmp',
        featureName: 'f',
        taskFolder: 't',
        summary: 'Did some work on the feature implementation today',
        specContent: 'Configure authentication middleware with OAuth2 tokens',
      });
      const summaryCheck = report.criteria.find(c => c.name === 'summary-quality');
      expect(summaryCheck?.passed).toBe(false);
    });
  });

  describe('AC match criterion', () => {
    test('passes when summary references AC keywords', async () => {
      const adapter = new FsVerificationAdapter(makeConfig({ buildCommand: 'true' }));
      const report = await adapter.verify({
        projectRoot: '/tmp',
        featureName: 'f',
        taskFolder: 't',
        summary: 'Added authentication endpoint with token validation and rate limiting',
        specContent: 'some spec content about authentication',
        acceptanceCriteria: '- Authentication endpoint returns tokens\n- Rate limiting is configured',
      });
      const acCheck = report.criteria.find(c => c.name === 'ac-match');
      expect(acCheck?.passed).toBe(true);
    });

    test('fails when summary misses AC keywords', async () => {
      const adapter = new FsVerificationAdapter(makeConfig({ buildCommand: 'true' }));
      const report = await adapter.verify({
        projectRoot: '/tmp',
        featureName: 'f',
        taskFolder: 't',
        summary: 'Updated the README and added comments',
        specContent: 'spec about database',
        acceptanceCriteria: '- Database migration runs successfully\n- Indexes created on all foreign keys',
      });
      const acCheck = report.criteria.find(c => c.name === 'ac-match');
      expect(acCheck?.passed).toBe(false);
    });

    test('skips gracefully when no AC', async () => {
      const adapter = new FsVerificationAdapter(makeConfig({ buildCommand: 'true' }));
      const report = await adapter.verify({
        projectRoot: '/tmp',
        featureName: 'f',
        taskFolder: 't',
        summary: 'Did the work as described in the spec and verified results',
        specContent: 'do the work and verify results',
      });
      const acCheck = report.criteria.find(c => c.name === 'ac-match');
      expect(acCheck).toBeUndefined(); // Not added when no AC
    });
  });

  describe('scoring', () => {
    test('score = passed / total', async () => {
      const adapter = new FsVerificationAdapter(makeConfig({
        buildCommand: 'true',
        scoreThreshold: 0.5,
      }));
      const report = await adapter.verify({
        projectRoot: '/tmp',
        featureName: 'f',
        taskFolder: 't',
        summary: 'Implemented authentication with proper token handling and validation',
        specContent: 'Implement authentication with token handling',
      });
      // build (true command) + git-diff + summary-quality = 3 criteria
      // All should pass except possibly git-diff (no repo)
      expect(report.score).toBeGreaterThan(0);
      expect(report.score).toBeLessThanOrEqual(1);
      expect(report.criteria.length).toBeGreaterThan(0);
    });

    test('threshold determines pass/fail', async () => {
      // With high threshold, even partial passes should fail
      const adapter = new FsVerificationAdapter(makeConfig({
        buildCommand: 'false', // will fail
        scoreThreshold: 1.0,
      }));
      const report = await adapter.verify({
        projectRoot: '/tmp',
        featureName: 'f',
        taskFolder: 't',
        summary: 'Implemented the complete feature with all requirements met and verified',
        specContent: 'implement complete feature requirements',
      });
      // Build fails -> score < 1.0 -> overall fail
      expect(report.passed).toBe(false);
    });
  });

  describe('build check', () => {
    test('passes with successful command', async () => {
      const adapter = new FsVerificationAdapter(makeConfig({ buildCommand: 'true' }));
      const report = await adapter.verify({
        projectRoot: '/tmp',
        featureName: 'f',
        taskFolder: 't',
        summary: 'Implemented the feature with proper type safety and testing coverage',
        specContent: 'implement feature with type safety',
      });
      const build = report.criteria.find(c => c.name === 'build');
      expect(build?.passed).toBe(true);
    });

    test('fails with failing command', async () => {
      const adapter = new FsVerificationAdapter(makeConfig({ buildCommand: 'false' }));
      const report = await adapter.verify({
        projectRoot: '/tmp',
        featureName: 'f',
        taskFolder: 't',
        summary: 'Implemented the feature with proper type safety and testing coverage',
        specContent: 'implement feature with type safety',
      });
      const build = report.criteria.find(c => c.name === 'build');
      expect(build?.passed).toBe(false);
    });

    test('timeout handled gracefully', async () => {
      const adapter = new FsVerificationAdapter(makeConfig({
        buildCommand: 'sleep 60',
        buildTimeoutMs: 200,
      }));
      const report = await adapter.verify({
        projectRoot: '/tmp',
        featureName: 'f',
        taskFolder: 't',
        summary: 'Implemented the feature with proper type safety and testing coverage',
        specContent: 'implement feature with type safety',
      });
      const build = report.criteria.find(c => c.name === 'build');
      expect(build?.passed).toBe(false);
      expect(build?.detail).toContain('timed out');
    }, 10000);
  });
});
