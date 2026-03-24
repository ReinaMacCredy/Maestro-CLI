/**
 * Factory wrapper for FsHandoffAdapter.
 */

import { FsHandoffAdapter } from '../../../../handoff/fs-adapter.ts';
import type { AdapterContext, AdapterFactory } from '../../../types.ts';
import type { HandoffPort } from '../../../../handoff/port.ts';
import type { TaskPort } from '../../../../tasks/port.ts';
import type { MemoryPort } from '../../../../memory/port.ts';

export const createAdapter: AdapterFactory<HandoffPort> = (ctx: AdapterContext) => {
  const taskPort = ctx.ports.taskPort as TaskPort;
  const memoryPort = ctx.ports.memoryPort as MemoryPort;
  return new FsHandoffAdapter(ctx.projectRoot, taskPort, memoryPort);
};
