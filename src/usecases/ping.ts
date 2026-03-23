/**
 * ping use case.
 * Returns version, project root, task backend, and integration availability.
 */

import type { ConfigPort } from '../ports/config.ts';
import type { GraphPort } from '../ports/graph.ts';
import type { HandoffPort } from '../ports/handoff.ts';
import type { SearchPort } from '../ports/search.ts';
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
