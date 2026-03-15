/**
 * Module-level singleton for service wiring.
 *
 * citty doesn't propagate parent context to subcommands (runCommand passes
 * only rawArgs), so we use a module-level singleton. Root command calls
 * initServices() in its run() before dispatching subcommands. Each subcommand
 * calls getServices().
 */

import { BrTaskAdapter } from './adapters/br.ts';
import { FsFeatureAdapter } from './adapters/fs/feature.ts';
import { FsPlanAdapter } from './adapters/fs/plan.ts';
import { FsContextAdapter } from './adapters/fs/context.ts';
import { FsSessionAdapter } from './adapters/fs/session.ts';
import { FsConfigAdapter } from './adapters/fs/config.ts';
import { FsAskAdapter } from './adapters/fs/ask.ts';
import { AgentsMdAdapter } from './adapters/agents-md.ts';
import { CliWorkerRunner } from './adapters/worker-runner.ts';
import { MaestroError } from './lib/errors.ts';
import type { TaskPort } from './ports/tasks.ts';
import type { FeaturePort } from './ports/features.ts';
import type { PlanPort } from './ports/plans.ts';
import type { ContextPort } from './ports/context.ts';
import type { SessionPort } from './ports/sessions.ts';
import type { WorkerRunnerPort } from './ports/worker-runner.ts';

export interface MaestroServices {
  taskPort: TaskPort;
  featureAdapter: FeaturePort;
  planAdapter: PlanPort;
  contextAdapter: ContextPort;
  sessionAdapter: SessionPort;
  configAdapter: FsConfigAdapter;
  askAdapter: FsAskAdapter;
  agentsMdAdapter: AgentsMdAdapter;
  workerRunner: WorkerRunnerPort;
  directory: string;
}

let _services: MaestroServices | undefined;

export function initServices(directory: string): MaestroServices {
  const contextAdapter = new FsContextAdapter(directory);

  _services = {
    taskPort: new BrTaskAdapter(directory),
    featureAdapter: new FsFeatureAdapter(directory),
    planAdapter: new FsPlanAdapter(directory),
    contextAdapter,
    sessionAdapter: new FsSessionAdapter(directory),
    configAdapter: new FsConfigAdapter(),
    askAdapter: new FsAskAdapter(directory),
    agentsMdAdapter: new AgentsMdAdapter(directory, contextAdapter),
    workerRunner: new CliWorkerRunner(),
    directory,
  };

  return _services;
}

export function getServices(): MaestroServices {
  if (!_services) {
    throw new MaestroError(
      'Services not initialized',
      ['Run maestro from a project directory with .maestro/ or run: maestro init'],
    );
  }
  return _services;
}
