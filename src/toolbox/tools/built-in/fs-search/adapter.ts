/**
 * Factory wrapper for FsSearchAdapter.
 */

import { FsSearchAdapter } from '../../../../search/fs-adapter.ts';
import type { AdapterContext, AdapterFactory } from '../../../types.ts';
import type { SearchPort } from '../../../../search/port.ts';

export const createAdapter: AdapterFactory<SearchPort> = (ctx: AdapterContext) => {
  return new FsSearchAdapter(ctx.projectRoot);
};
