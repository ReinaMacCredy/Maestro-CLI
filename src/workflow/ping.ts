/**
 * ping use case.
 * Returns version, project root, task backend, and integration availability.
 */

import type { GraphPort } from '../tasks/graph/port.ts';
import type { HandoffPort } from '../handoff/port.ts';
import type { SearchPort } from '../search/port.ts';
import { VERSION } from '../version.ts';

export interface PingServices {
  directory: string;
  taskBackend: 'fs' | 'br';
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
  return {
    version: VERSION,
    projectRoot: services.directory,
    taskBackend: services.taskBackend,
    integrations: {
      br: services.taskBackend === 'br',
      bv: !!services.graphPort,
      cass: !!services.searchPort,
      agentMail: !!services.handoffPort,
    },
  };
}
