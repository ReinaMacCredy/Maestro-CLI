/**
 * Module-level singleton for service wiring.
 *
 * citty doesn't propagate parent context to subcommands (runCommand passes
 * only rawArgs), so we use a module-level singleton. Root command calls
 * initServices() in its run() before dispatching subcommands. Each subcommand
 * calls getServices().
 */

import { FsTaskAdapter } from './tasks/adapter.ts';
import { BrTaskAdapter } from './adapters/br.ts';
import { BvGraphAdapter } from './adapters/bv-graph.ts';
import { CassSearchAdapter } from './adapters/cass-search.ts';
import { AgentMailHandoffAdapter } from './adapters/agent-mail-handoff.ts';
import { FsFeatureAdapter } from './features/adapter.ts';
import { FsPlanAdapter } from './plans/adapter.ts';
import { FsMemoryAdapter } from './memory/adapter.ts';
import { FsConfigAdapter } from './core/config.ts';
import { AgentsMdAdapter } from './features/agents-md.ts';
import { MaestroError } from './core/errors.ts';
import { checkCli } from './lib/cli-detect.ts';
import { resolveTaskBackend } from './core/resolve-backend.ts';
import type { ConfigBackend, ResolvedBackend } from './core/resolve-backend.ts';
import { FsVerificationAdapter } from './tasks/verification/adapter.ts';
import { resolveVerificationConfig } from './tasks/verification/config.ts';
import type { TaskPort } from './tasks/port.ts';
import type { VerificationPort } from './tasks/verification/port.ts';
import type { FeaturePort } from './features/port.ts';
import type { PlanPort } from './plans/port.ts';
import type { MemoryPort } from './memory/port.ts';
import type { GraphPort } from './tasks/graph/port.ts';
import type { HandoffPort } from './handoff/port.ts';
import type { SearchPort } from './search/port.ts';
import type { DoctrinePort } from './doctrine/port.ts';
import type { ConfigPort } from './core/config.ts';
import { FsDoctrineAdapter } from './doctrine/adapter.ts';

export interface MaestroServices {
  taskPort: TaskPort;
  verificationPort: VerificationPort;
  featureAdapter: FeaturePort;
  planAdapter: PlanPort;
  memoryAdapter: MemoryPort;
  configAdapter: ConfigPort;
  agentsMdAdapter: AgentsMdAdapter;
  directory: string;
  // Optional ports -- initialized based on tool availability
  graphPort?: GraphPort;
  handoffPort?: HandoffPort;
  searchPort?: SearchPort;
  doctrinePort?: DoctrinePort;
}

let _services: MaestroServices | undefined;
let _taskBackend: ResolvedBackend | undefined;
let _configuredBackend: ConfigBackend | undefined;

export function initServices(directory: string): MaestroServices {
  const memoryAdapter = new FsMemoryAdapter(directory);

  const configAdapter = new FsConfigAdapter();
  const config = configAdapter.get();
  _configuredBackend = config.taskBackend;
  _taskBackend = resolveTaskBackend(_configuredBackend, directory);
  const taskPort: TaskPort = _taskBackend === 'br'
    ? new BrTaskAdapter(directory)
    : new FsTaskAdapter(directory, config.claimExpiresMinutes);

  // Graph port: only if bv is installed
  const graphPort: GraphPort | undefined = checkCli('bv')
    ? new BvGraphAdapter(directory)
    : undefined;

  // Search port: only if cass is installed
  const searchPort: SearchPort | undefined = checkCli('cass')
    ? new CassSearchAdapter()
    : undefined;

  // Handoff port: Agent Mail (lazy -- actual connectivity check on first call)
  const handoffPort: HandoffPort | undefined = new AgentMailHandoffAdapter(
    directory, taskPort, memoryAdapter, configAdapter,
  );

  const verificationConfig = resolveVerificationConfig(config.verification);
  const verificationPort: VerificationPort = new FsVerificationAdapter(verificationConfig);

  _services = {
    taskPort,
    verificationPort,
    featureAdapter: new FsFeatureAdapter(directory),
    planAdapter: new FsPlanAdapter(directory),
    memoryAdapter,
    configAdapter,
    agentsMdAdapter: new AgentsMdAdapter(directory, memoryAdapter),
    directory,
    graphPort,
    handoffPort,
    searchPort,
    doctrinePort: new FsDoctrineAdapter(directory),
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

  // Hot-swap taskPort only when the config value itself changes
  const config = _services.configAdapter.get();
  if (config.taskBackend !== _configuredBackend) {
    _configuredBackend = config.taskBackend;
    const currentBackend = resolveTaskBackend(config.taskBackend, _services.directory);
    if (currentBackend !== _taskBackend) {
      _taskBackend = currentBackend;
      _services.taskPort = currentBackend === 'br'
        ? new BrTaskAdapter(_services.directory)
        : new FsTaskAdapter(_services.directory, config.claimExpiresMinutes);
    }
  }

  return _services;
}
