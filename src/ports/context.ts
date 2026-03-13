/**
 * ContextPort -- abstract interface for context storage.
 * Concrete implementation: FsContextAdapter.
 */

import type { ContextFile } from '../types.ts';

export interface ContextPort {
  write(featureName: string, fileName: string, content: string): string;
  read(featureName: string, fileName: string): string | null;
  list(featureName: string): ContextFile[];
  delete(featureName: string, fileName: string): boolean;
  compile(featureName: string): string;
  archive(featureName: string): { archived: string[]; archivePath: string };
  stats(featureName: string): { count: number; totalBytes: number; oldest?: string; newest?: string };
}
