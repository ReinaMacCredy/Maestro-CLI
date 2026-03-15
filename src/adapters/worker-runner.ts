import { spawn, type ChildProcess, type StdioOptions } from 'node:child_process';
import type { WorkerCliName } from '../types.ts';

export interface WorkerLaunchRequest {
  cli: WorkerCliName;
  cwd: string;
  instruction: string;
  model?: string;
  extraArgs?: string[];
  stdio?: StdioOptions;
  env?: NodeJS.ProcessEnv;
}

export interface WorkerLaunchSpec {
  launcher: WorkerCliName;
  command: string;
  args: string[];
}

export class CliWorkerRunner {
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
