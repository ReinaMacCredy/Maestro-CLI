/**
 * Factory wrapper for CassSearchAdapter.
 */

import { CassSearchAdapter } from '../../../../adapters/cass-search.ts';
import type { AdapterContext, AdapterFactory } from '../../../types.ts';
import type { SearchPort } from '../../../../search/port.ts';

export const createAdapter: AdapterFactory<SearchPort> = (_ctx: AdapterContext) => {
  return new CassSearchAdapter();
};
