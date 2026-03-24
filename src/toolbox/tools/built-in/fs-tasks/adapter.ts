/**
 * Factory wrapper for FsTaskAdapter.
 */

import { FsTaskAdapter } from '../../../../tasks/adapter.ts';
import type { AdapterContext, AdapterFactory } from '../../../types.ts';
import type { TaskPort } from '../../../../tasks/port.ts';

export const createAdapter: AdapterFactory<TaskPort> = (ctx: AdapterContext) => {
  const claimExpires = ctx.settings.tasks.claimExpiresMinutes;
  return new FsTaskAdapter(ctx.projectRoot, claimExpires);
};
