/**
 * E2E test harness for maestroCLI.
 * Creates a temp directory with git + .maestro/ setup, provides a run() helper
 * that shells out to `bun src/cli.ts`.
 */

import { mkdtemp, rm, realpath } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export interface TestHarness {
  dir: string;
  run: (...args: string[]) => Promise<RunResult>;
  cleanup: () => Promise<void>;
}

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const CLI_PATH = join(import.meta.dir, '../../cli.ts');

export async function createTestHarness(): Promise<TestHarness> {
  const rawDir = await mkdtemp(join(tmpdir(), 'maestro-e2e-'));
  const dir = await realpath(rawDir);

  // Initialize git
  const gitInit = Bun.spawn(['git', 'init'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' });
  await gitInit.exited;

  // Configure git user for commits
  const gitName = Bun.spawn(['git', 'config', 'user.name', 'Test'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' });
  await gitName.exited;
  const gitEmail = Bun.spawn(['git', 'config', 'user.email', 'test@test.com'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' });
  await gitEmail.exited;

  // Create initial commit so git audit capture has a valid HEAD
  const touch = Bun.spawn(['touch', '.gitkeep'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' });
  await touch.exited;
  const gitAdd = Bun.spawn(['git', 'add', '.'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' });
  await gitAdd.exited;
  const gitCommit = Bun.spawn(['git', 'commit', '-m', 'init'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' });
  await gitCommit.exited;

  async function run(...args: string[]): Promise<RunResult> {
    const proc = Bun.spawn(['bun', CLI_PATH, '--json', ...args], {
      cwd: dir,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, HOME: process.env.HOME },
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
  }

  async function cleanup() {
    await rm(dir, { recursive: true, force: true });
  }

  return { dir, run, cleanup };
}
