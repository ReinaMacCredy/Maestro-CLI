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
import { BvGraphAdapter } from './adapters/bv-graph.ts';
import { CassSearchAdapter } from './adapters/cass-search.ts';
import { AgentMailHandoffAdapter } from './adapters/agent-mail-handoff.ts';
import { FsFeatureAdapter } from './adapters/fs/feature.ts';
import { FsPlanAdapter } from './adapters/fs/plan.ts';
import { FsMemoryAdapter } from './adapters/fs/memory.ts';
import { FsConfigAdapter } from './adapters/fs/config.ts';
import { AgentsMdAdapter } from './adapters/agents-md.ts';
import { MaestroError } from './lib/errors.ts';
import { checkCli } from './lib/cli-detect.ts';
import { FsVerificationAdapter } from './adapters/verification.ts';
import { resolveVerificationConfig } from './utils/verification-config.ts';
import type { TaskPort } from './ports/tasks.ts';
import type { VerificationPort } from './ports/verification.ts';
import type { FeaturePort } from './ports/features.ts';
import type { PlanPort } from './ports/plans.ts';
import type { MemoryPort } from './ports/memory.ts';
import type { GraphPort } from './ports/graph.ts';
import type { HandoffPort } from './ports/handoff.ts';
import type { SearchPort } from './ports/search.ts';

export interface MaestroServices {
  taskPort: TaskPort;
  verificationPort: VerificationPort;
  featureAdapter: FeaturePort;
  planAdapter: PlanPort;
  memoryAdapter: MemoryPort;
  configAdapter: FsConfigAdapter;
  agentsMdAdapter: AgentsMdAdapter;
  directory: string;
  // Optional ports -- initialized based on tool availability
  graphPort?: GraphPort;
  handoffPort?: HandoffPort;
  searchPort?: SearchPort;
}

let _services: MaestroServices | undefined;
let _taskBackend: string | undefined;

export function initServices(directory: string): MaestroServices {
  const memoryAdapter = new FsMemoryAdapter(directory);

  const configAdapter = new FsConfigAdapter();
  const config = configAdapter.get();
  _taskBackend = config.taskBackend ?? 'fs';
  const taskPort: TaskPort = config.taskBackend === 'br'
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

  // Hot-swap taskPort if taskBackend config changed mid-session
  const config = _services.configAdapter.get();
  const currentBackend = config.taskBackend ?? 'fs';
  if (currentBackend !== _taskBackend) {
    _taskBackend = currentBackend;
    _services.taskPort = currentBackend === 'br'
      ? new BrTaskAdapter(_services.directory)
      : new FsTaskAdapter(_services.directory, config.claimExpiresMinutes);
  }

  return _services;
}
