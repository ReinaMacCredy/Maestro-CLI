import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { FsTaskAdapter } from '../../adapters/fs-tasks.ts';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FsTaskAdapter.getRichFields', () => {
  let tmpDir: string;
  let adapter: FsTaskAdapter;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-rich-fields-'));
    const featureDir = path.join(tmpDir, '.maestro', 'features', 'test-feat');
    fs.mkdirSync(featureDir, { recursive: true });
    adapter = new FsTaskAdapter(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns null when no spec exists', async () => {
    await adapter.create('test-feat', 'No Spec Task');
    const result = await adapter.getRichFields('test-feat', '01-no-spec-task');
    expect(result).toBeNull();
  });

  test('returns null when spec has no Plan Section heading', async () => {
    await adapter.create('test-feat', 'Wrong Format');
    await adapter.writeSpec('test-feat', '01-wrong-format', '# Just a title\n\nSome content without plan section.');
    const result = await adapter.getRichFields('test-feat', '01-wrong-format');
    expect(result).toBeNull();
  });

  test('returns description when plan section has no Design/AC subsections', async () => {
    await adapter.create('test-feat', 'Basic Task');
    const spec = [
      '## Plan Section',
      'Implement the widget rendering pipeline.',
      'Use React for the frontend.',
      '',
      '## Other Section',
      'Unrelated content.',
    ].join('\n');
    await adapter.writeSpec('test-feat', '01-basic-task', spec);

    const result = await adapter.getRichFields('test-feat', '01-basic-task');
    expect(result).not.toBeNull();
    expect(result!.description).toContain('Implement the widget rendering pipeline');
    expect(result!.design).toBeUndefined();
    expect(result!.acceptanceCriteria).toBeUndefined();
  });

  test('returns description, design, and acceptanceCriteria when all present', async () => {
    await adapter.create('test-feat', 'Full Task');
    const spec = [
      '## Plan Section',
      'Build the authentication module.',
      '',
      '#### Design',
      'Use JWT tokens with refresh rotation.',
      'Store tokens in httpOnly cookies.',
      '',
      '#### Acceptance Criteria',
      '- [ ] Login endpoint returns JWT',
      '- [ ] Refresh endpoint rotates tokens',
      '',
      '## Other Section',
      'Unrelated.',
    ].join('\n');
    await adapter.writeSpec('test-feat', '01-full-task', spec);

    const result = await adapter.getRichFields('test-feat', '01-full-task');
    expect(result).not.toBeNull();
    expect(result!.description).toContain('Build the authentication module');
    expect(result!.design).toContain('JWT tokens');
    expect(result!.acceptanceCriteria).toContain('Login endpoint');
  });
});
