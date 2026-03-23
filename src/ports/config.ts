import type { HiveConfig } from '../core/types.ts';

export interface ConfigPort {
  get(): HiveConfig;
}
