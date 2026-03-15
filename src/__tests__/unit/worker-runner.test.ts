import { describe, expect, test } from 'bun:test';
import { CliWorkerRunner } from '../../adapters/worker-runner.ts';

describe('CliWorkerRunner', () => {
  const runner = new CliWorkerRunner();

  test('builds codex launch spec with full-auto prompt mode', () => {
    const spec = runner.buildLaunchSpec({
      cli: 'codex',
      cwd: '/repo',
      instruction: 'Read and follow .maestro/features/f/tasks/01/worker-prompt.md',
      model: 'o3',
      extraArgs: ['--search'],
    });

    expect(spec.command).toBe('codex');
    expect(spec.args).toEqual([
      'exec',
      '--full-auto',
      '-C',
      '/repo',
      '--model',
      'o3',
      '--search',
      'Read and follow .maestro/features/f/tasks/01/worker-prompt.md',
    ]);
  });

  test('builds claude launch spec with print mode', () => {
    const spec = runner.buildLaunchSpec({
      cli: 'claude',
      cwd: '/repo',
      instruction: 'Read and follow .maestro/features/f/tasks/01/worker-prompt.md',
      model: 'sonnet',
      extraArgs: ['--verbose'],
    });

    expect(spec.command).toBe('claude');
    expect(spec.args).toEqual([
      '-p',
      '--permission-mode',
      'auto',
      '--model',
      'sonnet',
      '--verbose',
      'Read and follow .maestro/features/f/tasks/01/worker-prompt.md',
    ]);
  });
});
