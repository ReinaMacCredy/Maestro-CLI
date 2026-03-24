/**
 * Module-level singleton for service wiring.
 *
 * citty doesn't propagate parent context to subcommands (runCommand passes
 * only rawArgs), so we use a module-level singleton. Root command calls
 * initServices() in its run() before dispatching subcommands. Each subcommand
 * calls getServices().
 *
 * v2: Toolbox-driven port resolution. The ToolboxRegistry decides which
 * adapter wins for each port based on manifest priority, install detection,
 * and allow/deny settings. Static adapter imports are used (no dynamic
 * import()) so hooks can safely call initServices() through the bundler.
 */

// Static adapter imports -- always available, no dynamic import()
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
import { FsVerificationAdapter } from './tasks/verification/adapter.ts';
import { resolveVerificationConfig } from './tasks/verification/config.ts';
import { FsDoctrineAdapter } from './doctrine/adapter.ts';
import { FsSettingsAdapter } from './core/settings-adapter.ts';
import { buildToolbox, ToolboxRegistry } from './toolbox/registry.ts';
import type { MaestroSettings, SettingsPort } from './core/settings.ts';
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

export interface MaestroServices {
  taskPort: TaskPort;
  verificationPort: VerificationPort;
  featureAdapter: FeaturePort;
  planAdapter: PlanPort;
  memoryAdapter: MemoryPort;
  configAdapter: ConfigPort;
  agentsMdAdapter: AgentsMdAdapter;
  directory: string;
  // Optional ports -- initialized based on toolbox availability
  graphPort?: GraphPort;
  handoffPort?: HandoffPort;
  searchPort?: SearchPort;
  doctrinePort?: DoctrinePort;
  // v2: toolbox + settings
  toolbox: ToolboxRegistry;
  settingsPort: SettingsPort;
  /** Resolved task backend: 'fs' or 'br'. Use this instead of resolveTaskBackend(). */
  taskBackend: 'fs' | 'br';
}

let _services: MaestroServices | undefined;

// ============================================================================
// Toolbox-driven port resolution (static adapters)
// ============================================================================

function resolveTaskPort(
  toolbox: ToolboxRegistry,
  settings: MaestroSettings,
  directory: string,
): { port: TaskPort; backend: 'fs' | 'br' } {
  // Explicit backend choice overrides toolbox priority
  if (settings.tasks.backend === 'fs') {
    return { port: new FsTaskAdapter(directory, settings.tasks.claimExpiresMinutes), backend: 'fs' };
  }
  if (settings.tasks.backend === 'br') {
    if (toolbox.isAvailable('br')) {
      return { port: new BrTaskAdapter(directory), backend: 'br' };
    }
    return { port: new FsTaskAdapter(directory, settings.tasks.claimExpiresMinutes), backend: 'fs' };
  }
  // 'auto': toolbox resolves by priority (br > fs-tasks if installed)
  const provider = toolbox.resolveProvider('tasks');
  if (provider?.name === 'br') {
    return { port: new BrTaskAdapter(directory), backend: 'br' };
  }
  return { port: new FsTaskAdapter(directory, settings.tasks.claimExpiresMinutes), backend: 'fs' };
}

function resolveGraphPort(
  toolbox: ToolboxRegistry,
  directory: string,
): GraphPort | undefined {
  if (!toolbox.resolveProvider('graph')) return undefined;
  return new BvGraphAdapter(directory);
}

function resolveSearchPort(
  toolbox: ToolboxRegistry,
): SearchPort | undefined {
  if (!toolbox.resolveProvider('search')) return undefined;
  return new CassSearchAdapter();
}

function resolveHandoffPort(
  toolbox: ToolboxRegistry,
  directory: string,
  taskPort: TaskPort,
  memoryAdapter: MemoryPort,
  configAdapter: ConfigPort,
): HandoffPort | undefined {
  if (!toolbox.resolveProvider('handoff')) return undefined;
  return new AgentMailHandoffAdapter(directory, taskPort, memoryAdapter, configAdapter);
}

// ============================================================================
// Init / Get
// ============================================================================

export function initServices(
  directory: string,
  toolbox?: ToolboxRegistry,
): MaestroServices {
  const settingsAdapter = new FsSettingsAdapter(directory);
  const settings = settingsAdapter.get();
  const tb = toolbox ?? buildToolbox(settings);

  // Always built-in (not toolbox-driven)
  const memoryAdapter = new FsMemoryAdapter(directory);
  const configAdapter = new FsConfigAdapter();
  const config = configAdapter.get();
  const verificationConfig = resolveVerificationConfig(config.verification);

  // Phase 1: independent ports (no cross-port deps)
  const { port: taskPort, backend: taskBackend } = resolveTaskPort(tb, settings, directory);
  const graphPort = resolveGraphPort(tb, directory);
  const searchPort = resolveSearchPort(tb);

  // Phase 2: dependent ports (need Phase 1 results)
  const handoffPort = resolveHandoffPort(tb, directory, taskPort, memoryAdapter, configAdapter);

  _services = {
    taskPort,
    taskBackend,
    verificationPort: new FsVerificationAdapter(verificationConfig),
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
    toolbox: tb,
    settingsPort: settingsAdapter,
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

  // Hot-swap taskPort when settings.tasks.backend changes
  const settings = _services.settingsPort.get();
  const { port, backend } = resolveTaskPort(_services.toolbox, settings, _services.directory);
  if (backend !== _services.taskBackend) {
    _services.taskPort = port;
    _services.taskBackend = backend;
  }

  return _services;
}
