import type { HiveConfig } from '../types.ts';

export interface ConfigPort {
  get(): HiveConfig;
}
