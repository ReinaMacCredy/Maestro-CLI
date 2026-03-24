/**
 * Factory wrapper for BvGraphAdapter.
 */

import { BvGraphAdapter } from '../../../../adapters/bv-graph.ts';
import type { AdapterContext, AdapterFactory } from '../../../types.ts';
import type { GraphPort } from '../../../../tasks/graph/port.ts';

export const createAdapter: AdapterFactory<GraphPort> = (ctx: AdapterContext) => {
  return new BvGraphAdapter(ctx.projectRoot);
};
