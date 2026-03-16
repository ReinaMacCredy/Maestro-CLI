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
import { FsMemoryAdapter } from './adapters/fs/memory.ts';
import { FsConfigAdapter } from './adapters/fs/config.ts';
import { AgentsMdAdapter } from './adapters/agents-md.ts';
import { MaestroError } from './lib/errors.ts';
import type { TaskPort } from './ports/tasks.ts';
import type { FeaturePort } from './ports/features.ts';
import type { PlanPort } from './ports/plans.ts';
import type { MemoryPort } from './ports/memory.ts';

export interface MaestroServices {
  taskPort: TaskPort;
  featureAdapter: FeaturePort;
  planAdapter: PlanPort;
  memoryAdapter: MemoryPort;
  configAdapter: FsConfigAdapter;
  agentsMdAdapter: AgentsMdAdapter;
  directory: string;
}

let _services: MaestroServices | undefined;

export function initServices(directory: string): MaestroServices {
  const memoryAdapter = new FsMemoryAdapter(directory);

  const configAdapter = new FsConfigAdapter();
  const config = configAdapter.get();
  const taskPort: TaskPort = config.taskBackend === 'br'
    ? new BrTaskAdapter(directory)
    : new FsTaskAdapter(directory, config.claimExpiresMinutes);

  _services = {
    taskPort,
    featureAdapter: new FsFeatureAdapter(directory),
    planAdapter: new FsPlanAdapter(directory),
    memoryAdapter,
    configAdapter,
    agentsMdAdapter: new AgentsMdAdapter(directory, memoryAdapter),
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
