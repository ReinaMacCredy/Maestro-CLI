/**
 * Module-level singleton for service wiring.
 *
 * citty doesn't propagate parent context to subcommands (runCommand passes
 * only rawArgs), so we use a module-level singleton. Root command calls
 * initServices() in its run() before dispatching subcommands. Each subcommand
 * calls getServices().
 */

import { FsTaskAdapter } from './adapters/fs-tasks.ts';
import { BrTaskAdapter } from './adapters/br.ts';
import { FsFeatureAdapter } from './adapters/fs/feature.ts';
import { FsPlanAdapter } from './adapters/fs/plan.ts';
import { FsContextAdapter } from './adapters/fs/context.ts';
import { FsConfigAdapter } from './adapters/fs/config.ts';
import { AgentsMdAdapter } from './adapters/agents-md.ts';
import { MaestroError } from './lib/errors.ts';
import type { TaskPort } from './ports/tasks.ts';
import type { FeaturePort } from './ports/features.ts';
import type { PlanPort } from './ports/plans.ts';
import type { ContextPort } from './ports/context.ts';

export interface MaestroServices {
  taskPort: TaskPort;
  featureAdapter: FeaturePort;
  planAdapter: PlanPort;
  contextAdapter: ContextPort;
  configAdapter: FsConfigAdapter;
  agentsMdAdapter: AgentsMdAdapter;
  directory: string;
}

let _services: MaestroServices | undefined;

export function initServices(directory: string): MaestroServices {
  const contextAdapter = new FsContextAdapter(directory);

  const configAdapter = new FsConfigAdapter();
  const taskBackend = configAdapter.get().taskBackend;
  const taskPort: TaskPort = taskBackend === 'br'
    ? new BrTaskAdapter(directory)
    : new FsTaskAdapter(directory);

  _services = {
    taskPort,
    featureAdapter: new FsFeatureAdapter(directory),
    planAdapter: new FsPlanAdapter(directory),
    contextAdapter,
    configAdapter,
    agentsMdAdapter: new AgentsMdAdapter(directory, contextAdapter),
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
