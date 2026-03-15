import { spawn, type ChildProcess } from 'node:child_process';
import type { WorkerRunnerPort, WorkerLaunchRequest, WorkerLaunchSpec } from '../ports/worker-runner.ts';

export type { WorkerLaunchRequest, WorkerLaunchSpec } from '../ports/worker-runner.ts';

export class CliWorkerRunner implements WorkerRunnerPort {
  buildLaunchSpec(request: WorkerLaunchRequest): WorkerLaunchSpec {
    const { cli, cwd, instruction, model, extraArgs = [] } = request;

    if (cli === 'claude') {
      const args = ['-p', '--permission-mode', 'auto'];
      if (model) args.push('--model', model);
      args.push(...extraArgs, instruction);
      return {
        launcher: cli,
        command: 'claude',
        args,
      };
    }

    const args = ['exec', '--full-auto', '-C', cwd];
    if (model) args.push('--model', model);
    args.push(...extraArgs, instruction);
    return {
      launcher: cli,
      command: 'codex',
      args,
    };
  }

  launch(request: WorkerLaunchRequest): { child: ChildProcess; spec: WorkerLaunchSpec } {
    const spec = this.buildLaunchSpec(request);
    const child = spawn(spec.command, spec.args, {
      cwd: request.cwd,
      stdio: request.stdio ?? 'inherit',
      env: request.env ?? process.env,
    });

    return { child, spec };
  }
}
