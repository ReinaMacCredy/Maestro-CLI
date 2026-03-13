import { describe, test, expect } from 'bun:test';
import { detectInstall, selfUpdate, type ExecResult } from '../../usecases/self-update.ts';
import { MaestroError } from '../../lib/errors.ts';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// --- Mock executor ---

interface MockCall {
  cmd: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

function createMockExec(calls: MockCall[]) {
  let callIndex = 0;
  const invocations: string[][] = [];

  const exec = async (cmd: string[], _opts: { cwd: string }): Promise<ExecResult> => {
    invocations.push(cmd);
    if (callIndex >= calls.length) {
      throw new Error(`Unexpected exec call #${callIndex}: ${cmd.join(' ')}`);
    }
    const expected = calls[callIndex++];
    return { exitCode: expected.exitCode, stdout: expected.stdout, stderr: expected.stderr };
  };

  return { exec, invocations, assertAllCalled: () => expect(callIndex).toBe(calls.length) };
}

// --- detectInstall ---

describe('detectInstall', () => {
  test('returns standalone when no repo found', () => {
    // Use a real path that exists but isn't inside a maestro repo
    const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-standalone-')));
    const fakeBinary = path.join(tmpDir, 'maestro');
    fs.writeFileSync(fakeBinary, 'binary');
    try {
      const result = detectInstall(fakeBinary);
      expect(result.method).toBe('standalone');
      expect(result.repoPath).toBeNull();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns symlink-to-repo when execPath differs from realPath and repo found', () => {
    const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-test-')));
    try {
      // Create a fake repo structure
      fs.mkdirSync(path.join(tmpDir, '.git'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'maestro-cli' }));
      fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });
      const binaryPath = path.join(tmpDir, 'dist', 'maestro');
      fs.writeFileSync(binaryPath, 'binary');

      // Create a symlink elsewhere
      const linkDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-link-')));
      const linkPath = path.join(linkDir, 'maestro');
      fs.symlinkSync(binaryPath, linkPath);

      const result = detectInstall(linkPath);
      expect(result.method).toBe('symlink-to-repo');
      expect(result.repoPath).toBe(tmpDir);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns in-repo when execPath equals realPath and repo found', () => {
    const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-test-')));
    try {
      fs.mkdirSync(path.join(tmpDir, '.git'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'maestro-cli' }));
      fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });
      const binaryPath = path.join(tmpDir, 'dist', 'maestro');
      fs.writeFileSync(binaryPath, 'binary');

      const result = detectInstall(binaryPath);
      expect(result.method).toBe('in-repo');
      expect(result.repoPath).toBe(tmpDir);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns unknown when execPath cannot be resolved', () => {
    const result = detectInstall('/nonexistent/path/to/maestro');
    expect(result.method).toBe('unknown');
    expect(result.repoPath).toBeNull();
  });
});

// --- selfUpdate ---

describe('selfUpdate', () => {
  const repoPath = '/fake/repo';
  const binaryPath = '/fake/repo/dist/maestro';

  // Pre-check stubs reused across tests (branch, bun, sha run in parallel)
  const preChecksOk = (sha: string) => [
    { cmd: ['git', 'rev-parse', '--abbrev-ref', 'HEAD'], exitCode: 0, stdout: 'main\n', stderr: '' },
    { cmd: ['which', 'bun'], exitCode: 0, stdout: '/usr/local/bin/bun\n', stderr: '' },
    { cmd: ['git', 'rev-parse', 'HEAD'], exitCode: 0, stdout: `${sha}\n`, stderr: '' },
  ];

  test('returns not-updated when SHA unchanged (build NOT called)', async () => {
    const sha = 'abc1234def5678';
    const mock = createMockExec([
      ...preChecksOk(sha),
      { cmd: ['git', 'pull', '--ff-only'], exitCode: 0, stdout: 'Already up to date.\n', stderr: '' },
      { cmd: ['git', 'rev-parse', 'HEAD'], exitCode: 0, stdout: `${sha}\n`, stderr: '' },
    ]);

    const result = await selfUpdate({ exec: mock.exec }, { repoPath, binaryPath });
    expect(result.updated).toBe(false);
    expect(result.beforeSha).toBe(sha);
    // build should NOT have been called (only 5 calls, not 6)
    mock.assertAllCalled();
  });

  test('returns updated with SHAs when pull brings new commits (build called)', async () => {
    const before = 'abc1234';
    const after = 'def5678';
    const mock = createMockExec([
      ...preChecksOk(before),
      { cmd: ['git', 'pull', '--ff-only'], exitCode: 0, stdout: 'Updating abc..def\n', stderr: '' },
      { cmd: ['git', 'rev-parse', 'HEAD'], exitCode: 0, stdout: `${after}\n`, stderr: '' },
      { cmd: ['bun', 'run', 'build'], exitCode: 0, stdout: 'done\n', stderr: '' },
    ]);

    const result = await selfUpdate({ exec: mock.exec }, { repoPath, binaryPath });
    expect(result.updated).toBe(true);
    expect(result.beforeSha).toBe(before);
    expect(result.afterSha).toBe(after);
    mock.assertAllCalled();
  });

  test('throws MaestroError when not on main branch', async () => {
    const mock = createMockExec([
      { cmd: ['git', 'rev-parse', '--abbrev-ref', 'HEAD'], exitCode: 0, stdout: 'feature-x\n', stderr: '' },
      { cmd: ['which', 'bun'], exitCode: 0, stdout: '/usr/local/bin/bun\n', stderr: '' },
      { cmd: ['git', 'rev-parse', 'HEAD'], exitCode: 0, stdout: 'abc1234\n', stderr: '' },
    ]);

    try {
      await selfUpdate({ exec: mock.exec }, { repoPath, binaryPath });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(MaestroError);
      expect((err as MaestroError).message).toContain('feature-x');
      expect((err as MaestroError).message).toContain('expected "main"');
    }
  });

  test('throws MaestroError when bun not found', async () => {
    const mock = createMockExec([
      { cmd: ['git', 'rev-parse', '--abbrev-ref', 'HEAD'], exitCode: 0, stdout: 'main\n', stderr: '' },
      { cmd: ['which', 'bun'], exitCode: 1, stdout: '', stderr: '' },
      { cmd: ['git', 'rev-parse', 'HEAD'], exitCode: 0, stdout: 'abc1234\n', stderr: '' },
    ]);

    try {
      await selfUpdate({ exec: mock.exec }, { repoPath, binaryPath });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(MaestroError);
      expect((err as MaestroError).message).toContain('bun not found');
    }
  });

  test('throws MaestroError when git pull fails (includes stderr)', async () => {
    const mock = createMockExec([
      ...preChecksOk('abc1234'),
      { cmd: ['git', 'pull', '--ff-only'], exitCode: 1, stdout: '', stderr: 'fatal: Not possible to fast-forward' },
    ]);

    try {
      await selfUpdate({ exec: mock.exec }, { repoPath, binaryPath });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(MaestroError);
      expect((err as MaestroError).message).toContain('git pull --ff-only failed');
      expect((err as MaestroError).message).toContain('Not possible to fast-forward');
    }
  });

  test('throws MaestroError when build fails (includes stale binary hint)', async () => {
    const mock = createMockExec([
      ...preChecksOk('abc1234'),
      { cmd: ['git', 'pull', '--ff-only'], exitCode: 0, stdout: 'Updating\n', stderr: '' },
      { cmd: ['git', 'rev-parse', 'HEAD'], exitCode: 0, stdout: 'def5678\n', stderr: '' },
      { cmd: ['bun', 'run', 'build'], exitCode: 1, stdout: '', stderr: 'Build error' },
    ]);

    try {
      await selfUpdate({ exec: mock.exec }, { repoPath, binaryPath });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(MaestroError);
      expect((err as MaestroError).message).toContain('build failed after repo update');
      expect((err as MaestroError).hints[0]).toContain('bun run build');
    }
  });
});
