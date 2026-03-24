/**
 * doctor use case.
 * Validates config, checks integrations, reports health.
 */

import type { ConfigPort } from '../core/config.ts';
import type { FeaturePort } from '../features/port.ts';
import type { TaskPort } from '../tasks/port.ts';
import type { GraphPort } from '../tasks/graph/port.ts';
import type { HandoffPort } from '../handoff/port.ts';
import type { SearchPort } from '../search/port.ts';
import type { DoctrinePort } from '../doctrine/port.ts';

export interface DoctorServices {
  configAdapter: ConfigPort;
  featureAdapter: FeaturePort;
  taskPort: TaskPort;
  directory: string;
  graphPort?: GraphPort;
  handoffPort?: HandoffPort;
  searchPort?: SearchPort;
  doctrinePort?: DoctrinePort;
}

export type CheckStatus = 'ok' | 'warn' | 'fail';

export interface Check {
  name: string;
  status: CheckStatus;
  message: string;
}

export interface DoctorReport {
  checks: Check[];
  summary: { ok: number; warn: number; fail: number };
}

export async function doctor(services: DoctorServices): Promise<DoctorReport> {
  const checks: Check[] = [];

  // 1. Config check
  try {
    services.configAdapter.get();
    checks.push({ name: 'config', status: 'ok', message: 'Config loaded' });
  } catch {
    checks.push({ name: 'config', status: 'fail', message: 'Config failed to load' });
  }

  // 2. Active feature check + 3. Task backend check (share getActive result)
  let active: ReturnType<typeof services.featureAdapter.getActive> = null;
  try {
    active = services.featureAdapter.getActive();
    if (active) {
      checks.push({ name: 'active-feature', status: 'ok', message: `Active: ${active.name}` });
    } else {
      checks.push({ name: 'active-feature', status: 'warn', message: 'No active feature' });
    }
  } catch {
    checks.push({ name: 'active-feature', status: 'fail', message: 'Feature adapter error' });
  }

  try {
    if (active) {
      await services.taskPort.list(active.name);
      checks.push({ name: 'task-backend', status: 'ok', message: 'Task backend reachable' });
    } else {
      checks.push({ name: 'task-backend', status: 'warn', message: 'No active feature to test tasks' });
    }
  } catch {
    checks.push({ name: 'task-backend', status: 'fail', message: 'Task backend unreachable' });
  }

  // 4. Integration checks
  const integrations: Array<[string, unknown]> = [
    ['graph (bv)', services.graphPort],
    ['handoff (agent-mail)', services.handoffPort],
    ['search (cass)', services.searchPort],
    ['doctrine', services.doctrinePort],
  ];

  for (const [name, port] of integrations) {
    checks.push({
      name,
      status: port ? 'ok' : 'warn',
      message: port ? 'Available' : 'Not available',
    });
  }

  // Compute summary
  const summary = { ok: 0, warn: 0, fail: 0 };
  for (const check of checks) {
    summary[check.status]++;
  }

  return { checks, summary };
}
