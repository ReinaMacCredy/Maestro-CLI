/**
 * Factory wrapper for BrTaskAdapter.
 */

import { BrTaskAdapter } from '../../../../adapters/br.ts';
import type { AdapterContext, AdapterFactory } from '../../../types.ts';
import type { TaskPort } from '../../../../tasks/port.ts';

export const createAdapter: AdapterFactory<TaskPort> = (ctx: AdapterContext) => {
  return new BrTaskAdapter(ctx.projectRoot);
};
