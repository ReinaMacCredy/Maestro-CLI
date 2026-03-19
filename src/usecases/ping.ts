/**
 * ping use case.
 * Returns version, project root, task backend, and integration availability.
 */

import type { FsConfigAdapter } from '../adapters/fs/config.ts';
import type { GraphPort } from '../ports/graph.ts';
import type { HandoffPort } from '../ports/handoff.ts';
import type { SearchPort } from '../ports/search.ts';
import { VERSION } from '../version.ts';

export interface PingServices {
  configAdapter: FsConfigAdapter;
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

  return {
    version: VERSION,
    projectRoot: services.directory,
    taskBackend: config.taskBackend ?? 'fs',
    integrations: {
      br: config.taskBackend === 'br',
      bv: !!services.graphPort,
      cass: !!services.searchPort,
      agentMail: !!services.handoffPort,
    },
  };
}
