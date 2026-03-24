import { describe, test, expect } from 'bun:test';
import { inferMetadata } from '../../memory/execution/inference.ts';
import { InMemoryMemoryPort } from '../mocks/in-memory-memory-port.ts';

describe('inferMetadata', () => {
  test('infers decision category', () => {
    const result = inferMetadata('We decided to use PostgreSQL over MongoDB.', 'db-choice');
    expect(result.category).toBe('decision');
  });

  test('infers research category', () => {
    const result = inferMetadata('We found that the API supports pagination.', 'api-research');
    expect(result.category).toBe('research');
  });

  test('infers architecture category', () => {
    const result = inferMetadata('The architecture uses a hexagonal design pattern.', 'system-design');
    expect(result.category).toBe('architecture');
  });

  test('infers convention category', () => {
    const result = inferMetadata('Our convention is to always use kebab-case.', 'naming');
    expect(result.category).toBe('convention');
  });

  test('infers debug category', () => {
    const result = inferMetadata('Found a bug in the auth module. The workaround is to clear cache.', 'auth-fix');
    expect(result.category).toBe('debug');
  });

  test('defaults to research for unmatched content', () => {
    const result = inferMetadata('Some general notes about the project.', 'misc-notes');
    expect(result.category).toBe('research');
  });

  test('infers tags from filename', () => {
    const result = inferMetadata('Body content', 'api-endpoint-design');
    expect(result.tags).toContain('endpoint');
    expect(result.tags).toContain('design');
  });

  test('infers tags from headings', () => {
    const result = inferMetadata('# Authentication Flow\n\nDetails here.', 'notes');
    expect(result.tags).toContain('authentication');
    expect(result.tags).toContain('flow');
  });

  test('filters short words from tags', () => {
    const result = inferMetadata('# An API fix', 'my-api');
    // "an", "api", "fix", "my" are all < 4 chars, should be filtered
    expect(result.tags!.every(t => t.length >= 4)).toBe(true);
  });

  test('limits tags to 5', () => {
    const body = '# One Two Three Four Five Six Seven\n# Eight Nine Ten Eleven Twelve';
    const result = inferMetadata(body, 'lots-of-tags-here-many-words');
    expect(result.tags!.length).toBeLessThanOrEqual(5);
  });

  test('default priority is 2', () => {
    const result = inferMetadata('Body', 'test');
    expect(result.priority).toBe(2);
  });
});

describe('InMemoryMemoryPort.listWithMeta', () => {
  test('enriches memory with explicit frontmatter', () => {
    const port = new InMemoryMemoryPort();
    port.write('feat', 'auth-notes', '---\ntags: [auth, security]\npriority: 0\ncategory: decision\n---\nWe decided on JWT.');

    const files = port.listWithMeta('feat');
    expect(files).toHaveLength(1);
    expect(files[0].metadata.tags).toEqual(['auth', 'security']);
    expect(files[0].metadata.priority).toBe(0);
    expect(files[0].metadata.category).toBe('decision');
    expect(files[0].bodyContent).toBe('We decided on JWT.');
  });

  test('enriches memory with auto-inferred metadata (no frontmatter)', () => {
    const port = new InMemoryMemoryPort();
    port.write('feat', 'api-research', 'We found that the endpoint supports batch requests.');

    const files = port.listWithMeta('feat');
    expect(files).toHaveLength(1);
    expect(files[0].metadata.category).toBe('research');
    expect(files[0].metadata.priority).toBe(2);
    expect(files[0].metadata.tags!.length).toBeGreaterThan(0);
    expect(files[0].bodyContent).toBe('We found that the endpoint supports batch requests.');
  });

  test('handles mixed files (some with frontmatter, some without)', () => {
    const port = new InMemoryMemoryPort();
    port.write('feat', 'explicit', '---\ntags: [db]\ncategory: architecture\n---\nDB layer.');
    port.write('feat', 'implicit', 'We investigated the auth flow.');

    const files = port.listWithMeta('feat');
    expect(files).toHaveLength(2);

    const explicit = files.find(f => f.name === 'explicit')!;
    expect(explicit.metadata.tags).toEqual(['db']);
    expect(explicit.metadata.category).toBe('architecture');

    const implicit = files.find(f => f.name === 'implicit')!;
    expect(implicit.metadata.category).toBe('research');
    expect(implicit.metadata.tags!.length).toBeGreaterThan(0);
  });

  test('returns empty array for feature with no memories', () => {
    const port = new InMemoryMemoryPort();
    expect(port.listWithMeta('nonexistent')).toEqual([]);
  });
});
