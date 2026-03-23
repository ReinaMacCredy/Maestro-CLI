import { describe, test, expect } from 'bun:test';
import {
  parseFrontmatter,
  parseFrontmatterRich,
  stripFrontmatter,
  serializeFrontmatter,
} from '../../core/frontmatter.ts';

describe('parseFrontmatterRich', () => {
  test('parses inline arrays', () => {
    const content = '---\ntags: [auth, security, api]\n---\nBody';
    const result = parseFrontmatterRich(content);
    expect(result).not.toBeNull();
    expect(result!.tags).toEqual(['auth', 'security', 'api']);
  });

  test('parses numeric values', () => {
    const content = '---\npriority: 1\n---\nBody';
    const result = parseFrontmatterRich(content);
    expect(result).not.toBeNull();
    expect(result!.priority).toBe(1);
  });

  test('parses zero as number', () => {
    const content = '---\npriority: 0\n---\nBody';
    const result = parseFrontmatterRich(content);
    expect(result!.priority).toBe(0);
  });

  test('parses mixed types', () => {
    const content = '---\ntags: [auth, db]\npriority: 2\ncategory: decision\n---\nBody';
    const result = parseFrontmatterRich(content);
    expect(result).not.toBeNull();
    expect(result!.tags).toEqual(['auth', 'db']);
    expect(result!.priority).toBe(2);
    expect(result!.category).toBe('decision');
  });

  test('returns null for no frontmatter', () => {
    expect(parseFrontmatterRich('No frontmatter here')).toBeNull();
  });

  test('handles empty array', () => {
    const content = '---\ntags: []\n---\nBody';
    const result = parseFrontmatterRich(content);
    expect(result!.tags).toEqual([]);
  });

  test('multi-line YAML list items are skipped (not crash)', () => {
    const content = '---\ntags:\n- auth\n- security\npriority: 1\n---\nBody';
    const result = parseFrontmatterRich(content);
    // multi-line list degrades: tags key has empty value, list items skipped
    // priority still parsed correctly
    expect(result).not.toBeNull();
    expect(result!.priority).toBe(1);
  });

  test('strips quotes from string values', () => {
    const content = '---\ncategory: "decision"\n---\nBody';
    const result = parseFrontmatterRich(content);
    expect(result!.category).toBe('decision');
  });
});

describe('stripFrontmatter', () => {
  test('removes frontmatter block', () => {
    const content = '---\ntags: [auth]\npriority: 1\n---\nActual body content';
    expect(stripFrontmatter(content)).toBe('Actual body content');
  });

  test('returns content unchanged when no frontmatter', () => {
    const content = 'Just body content';
    expect(stripFrontmatter(content)).toBe('Just body content');
  });

  test('handles empty content', () => {
    expect(stripFrontmatter('')).toBe('');
  });

  test('handles content with only frontmatter', () => {
    const content = '---\nkey: value\n---\n';
    expect(stripFrontmatter(content)).toBe('');
  });
});

describe('serializeFrontmatter', () => {
  test('serializes simple values', () => {
    const result = serializeFrontmatter({ category: 'decision', priority: 1 });
    expect(result).toBe('---\ncategory: decision\npriority: 1\n---');
  });

  test('serializes arrays as inline', () => {
    const result = serializeFrontmatter({ tags: ['auth', 'api'] });
    expect(result).toBe('---\ntags: [auth, api]\n---');
  });

  test('skips null/undefined values', () => {
    const result = serializeFrontmatter({ category: 'research', priority: undefined, tags: null as unknown });
    expect(result).toBe('---\ncategory: research\n---');
  });

  test('round-trip: serialize then parse', () => {
    const original = { tags: ['auth', 'security'], priority: 1, category: 'decision' };
    const serialized = serializeFrontmatter(original);
    const parsed = parseFrontmatterRich(serialized + '\nBody');
    expect(parsed!.tags).toEqual(['auth', 'security']);
    expect(parsed!.priority).toBe(1);
    expect(parsed!.category).toBe('decision');
  });
});

describe('parseFrontmatter (original - regression)', () => {
  test('returns Record<string, string>', () => {
    const content = '---\nkey: value\ntags: [a, b]\n---\nBody';
    const result = parseFrontmatter(content);
    expect(result).not.toBeNull();
    // Original parser treats everything as strings
    expect(result!.key).toBe('value');
    expect(result!.tags).toBe('[a, b]');
  });

  test('returns null for no frontmatter', () => {
    expect(parseFrontmatter('No frontmatter')).toBeNull();
  });
});
