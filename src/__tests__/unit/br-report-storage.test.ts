import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BrTaskAdapter } from '../../adapters/br.ts';
import { getTaskReportPath } from '../../core/paths.ts';

describe('BrTaskAdapter report storage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-br-report-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writes reports to the local report.md sidecar', async () => {
    const adapter = new BrTaskAdapter(tmpDir);
    (adapter as any).exec = async () => {
      throw new Error('writeReport should not call br');
    };

    await adapter.writeReport('feat', '01-task', 'report content');

    expect(fs.readFileSync(getTaskReportPath(tmpDir, 'feat', '01-task'), 'utf8')).toBe('report content');
  });

  test('prefers the local sidecar report over BR notes', async () => {
    const adapter = new BrTaskAdapter(tmpDir);
    await adapter.writeReport('feat', '01-task', 'local report');

    (adapter as any).resolveBrId = () => 1;
    (adapter as any).getBrIssue = async () => ({
      notes: 'partial:summary\n<!-- baseCommit:abc123 -->',
    });

    const report = await adapter.readReport('feat', '01-task');

    expect(report).toBe('local report');
  });

  test('falls back to legacy reports stored in BR notes', async () => {
    const adapter = new BrTaskAdapter(tmpDir);

    (adapter as any).resolveBrId = () => 1;
    (adapter as any).getBrIssue = async () => ({
      notes: '# Task Report: 01-task\n\nLegacy report body',
    });

    const report = await adapter.readReport('feat', '01-task');

    expect(report).toContain('Legacy report body');
  });
});
