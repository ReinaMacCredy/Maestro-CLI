/**
 * Module-level singleton for service wiring.
 *
 * citty doesn't propagate parent context to subcommands (runCommand passes
 * only rawArgs), so we use a module-level singleton. Root command calls
 * initServices() in its run() before dispatching subcommands. Each subcommand
 * calls getServices().
 *
 * v2: Toolbox-driven port resolution via ADAPTER_FACTORIES registry.
 * External adapters are resolved by tool name from manifests, not hardcoded.
 */

// Built-in adapters (not toolbox-driven, always static)
import { FsFeatureAdapter } from './features/adapter.ts';
import { FsPlanAdapter } from './plans/adapter.ts';
import { FsMemoryAdapter } from './memory/adapter.ts';
import { AgentsMdAdapter } from './features/agents-md.ts';
import { MaestroError } from './core/errors.ts';
import { FsVerificationAdapter } from './tasks/verification/adapter.ts';
import { resolveVerificationConfig } from './tasks/verification/config.ts';
import { FsDoctrineAdapter } from './doctrine/adapter.ts';
import { FsSettingsAdapter } from './core/settings-adapter.ts';
import { FsTaskAdapter } from './tasks/adapter.ts';
import { buildToolbox, ToolboxRegistry } from './toolbox/registry.ts';
import { getAdapterFactory } from './toolbox/loader.ts';
import { buildAgentToolsRegistry, AgentToolsRegistry } from './toolbox/agents/registry.ts';
import type { AdapterContext } from './toolbox/types.ts';
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
export interface MaestroServices {
  taskPort: TaskPort;
  verificationPort: VerificationPort;
  featureAdapter: FeaturePort;
  planAdapter: PlanPort;
  memoryAdapter: MemoryPort;
  agentsMdAdapter: AgentsMdAdapter;
  directory: string;
  // Optional ports -- initialized based on toolbox availability
  graphPort?: GraphPort;
  handoffPort?: HandoffPort;
  searchPort?: SearchPort;
  doctrinePort?: DoctrinePort;
  // v2: toolbox + settings + agent tools + workflow
  toolbox: ToolboxRegistry;
  settingsPort: SettingsPort;
  agentToolsRegistry: AgentToolsRegistry;
  workflowRegistry?: import('./workflow/registry.ts').WorkflowRegistry;
  /** Resolved task backend: 'fs' or 'br'. Use this instead of resolveTaskBackend(). */
  taskBackend: 'fs' | 'br';
}

let _services: MaestroServices | undefined;

// ============================================================================
// Toolbox-driven port resolution via adapter factories
// ============================================================================

function buildContext(
  toolbox: ToolboxRegistry,
  settings: MaestroSettings,
  directory: string,
  ports: Record<string, unknown> = {},
): (toolName: string) => AdapterContext {
  return (toolName: string) => ({
    projectRoot: directory,
    settings,
    toolConfig: settings.toolbox.config[toolName] ?? {},
    manifest: toolbox.getManifest(toolName)!,
    ports,
  });
}

function resolveTaskPort(
  toolbox: ToolboxRegistry,
  settings: MaestroSettings,
  directory: string,
): { port: TaskPort; backend: 'fs' | 'br' } {
  const makeCtx = buildContext(toolbox, settings, directory);

  // Explicit backend choice overrides toolbox priority
  if (settings.tasks.backend === 'fs') {
    return { port: new FsTaskAdapter(directory, settings.tasks.claimExpiresMinutes), backend: 'fs' };
  }
  if (settings.tasks.backend === 'br') {
    const factory = toolbox.isAvailable('br') ? getAdapterFactory('br') : null;
    if (factory) return { port: factory(makeCtx('br')) as TaskPort, backend: 'br' };
    return { port: new FsTaskAdapter(directory, settings.tasks.claimExpiresMinutes), backend: 'fs' };
  }
  // 'auto': toolbox resolves by priority
  const provider = toolbox.resolveProvider('tasks');
  if (provider?.name === 'br') {
    const factory = getAdapterFactory('br');
    if (factory) return { port: factory(makeCtx('br')) as TaskPort, backend: 'br' };
  }
  return { port: new FsTaskAdapter(directory, settings.tasks.claimExpiresMinutes), backend: 'fs' };
}

function resolveOptionalPort<T>(
  toolbox: ToolboxRegistry,
  portName: string,
  makeCtx: (name: string) => AdapterContext,
): T | undefined {
  const provider = toolbox.resolveProvider(portName);
  if (!provider) return undefined;
  const factory = getAdapterFactory(provider.name);
  if (!factory) return undefined;
  return factory(makeCtx(provider.name)) as T;
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
  const verificationConfig = resolveVerificationConfig(settings.verification);

  // Phase 1: independent ports (no cross-port deps)
  const { port: taskPort, backend: taskBackend } = resolveTaskPort(tb, settings, directory);
  const makeCtx = buildContext(tb, settings, directory);
  const graphPort = resolveOptionalPort<GraphPort>(tb, 'graph', makeCtx);
  const searchPort = resolveOptionalPort<SearchPort>(tb, 'search', makeCtx);

  // Phase 2: dependent ports (need Phase 1 results)
  const makeCtxWithPorts = buildContext(tb, settings, directory, {
    taskPort, memoryPort: memoryAdapter, settingsPort: settingsAdapter, taskBackend,
  });
  const handoffPort = resolveOptionalPort<HandoffPort>(tb, 'handoff', makeCtxWithPorts);

  _services = {
    taskPort,
    taskBackend,
    verificationPort: new FsVerificationAdapter(verificationConfig),
    featureAdapter: new FsFeatureAdapter(directory),
    planAdapter: new FsPlanAdapter(directory),
    memoryAdapter,
    agentsMdAdapter: new AgentsMdAdapter(directory, memoryAdapter),
    directory,
    graphPort,
    handoffPort,
    searchPort,
    doctrinePort: new FsDoctrineAdapter(directory),
    toolbox: tb,
    settingsPort: settingsAdapter,
    agentToolsRegistry: buildAgentToolsRegistry(settings.agentTools),
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
