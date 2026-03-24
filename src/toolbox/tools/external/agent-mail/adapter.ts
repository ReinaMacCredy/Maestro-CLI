/**
 * Factory wrapper for AgentMailHandoffAdapter.
 */

import { AgentMailHandoffAdapter } from '../../../../adapters/agent-mail-handoff.ts';
import type { AdapterContext, AdapterFactory } from '../../../types.ts';
import type { HandoffPort } from '../../../../handoff/port.ts';
import type { TaskPort } from '../../../../tasks/port.ts';
import type { MemoryPort } from '../../../../memory/port.ts';
import type { ConfigPort } from '../../../../core/config.ts';

export const createAdapter: AdapterFactory<HandoffPort> = (ctx: AdapterContext) => {
  const taskPort = ctx.ports.taskPort as TaskPort;
  const memoryPort = ctx.ports.memoryPort as MemoryPort;
  const configPort = ctx.ports.configPort as ConfigPort;
  return new AgentMailHandoffAdapter(ctx.projectRoot, taskPort, memoryPort, configPort);
};
