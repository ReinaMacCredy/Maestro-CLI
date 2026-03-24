/**
 * Host mapping file I/O.
 * Reads/writes host-mapping.json per feature directory.
 */

import * as path from 'node:path';
import { readJson, writeJsonAtomic } from '../core/fs-io.ts';
import type { HostMapping } from './port.ts';

const MAPPING_FILE = 'host-mapping.json';

/** Read the host mapping for a feature. Returns empty mapping if file doesn't exist. */
export function readHostMapping(featureDir: string): HostMapping {
  return readJson<HostMapping>(path.join(featureDir, MAPPING_FILE)) ?? { tasks: {} };
}

/** Write the host mapping for a feature. */
export function writeHostMapping(featureDir: string, mapping: HostMapping): void {
  writeJsonAtomic(path.join(featureDir, MAPPING_FILE), mapping);
}
