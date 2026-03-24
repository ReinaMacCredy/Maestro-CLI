/**
 * ping use case.
 * Returns version, project root, task backend, and integration availability.
 */

import type { ConfigPort } from '../core/config.ts';
import type { GraphPort } from '../tasks/graph/port.ts';
import type { HandoffPort } from '../handoff/port.ts';
import type { SearchPort } from '../search/port.ts';
import { VERSION } from '../version.ts';
import { resolveTaskBackend } from '../core/resolve-backend.ts';

export interface PingServices {
  configAdapter: ConfigPort;
  directory: string;
  graphPort?: GraphPort;
  handoffPort?: HandoffPort;
  searchPort?: SearchPort;
}

export interface PingResult {
  version: string;
  projectRoot: string;
  taskBackend: string;
  integrations: {
    br: boolean;
    bv: boolean;
    cass: boolean;
    agentMail: boolean;
  };
}

export function ping(services: PingServices): PingResult {
  const config = services.configAdapter.get();
  const backend = resolveTaskBackend(config.taskBackend, services.directory);

  return {
    version: VERSION,
    projectRoot: services.directory,
    taskBackend: backend,
    integrations: {
      br: backend === 'br',
      bv: !!services.graphPort,
      cass: !!services.searchPort,
      agentMail: !!services.handoffPort,
    },
  };
}
