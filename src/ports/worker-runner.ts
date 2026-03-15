import type { ChildProcess, StdioOptions } from 'node:child_process';
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

export interface WorkerRunnerPort {
  buildLaunchSpec(request: WorkerLaunchRequest): WorkerLaunchSpec;
  launch(request: WorkerLaunchRequest): { child: ChildProcess; spec: WorkerLaunchSpec };
}
