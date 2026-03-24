/**
 * MemoryPort -- abstract interface for memory storage.
 * Concrete implementation: FsMemoryAdapter.
 */

import type { MemoryFile, MemoryFileWithMeta } from '../core/types.ts';

export interface MemoryPort {
  write(featureName: string, fileName: string, content: string): string;
  read(featureName: string, fileName: string): string | null;
  list(featureName: string): MemoryFile[];
  /** List with parsed metadata + body (for DCP scoring). */
  listWithMeta(featureName: string): MemoryFileWithMeta[];
  delete(featureName: string, fileName: string): boolean;
  compile(featureName: string): string;
  archive(featureName: string): { archived: string[]; archivePath: string };
  stats(featureName: string): { count: number; totalBytes: number; oldest?: string; newest?: string };
  /** Compress a memory: truncate body to first 200 chars, mark compressed in frontmatter. */
  compress(featureName: string, fileName: string): boolean;
  /** Return true if the memory's frontmatter has compressed: true. */
  isCompressed(featureName: string, fileName: string): boolean;
  /** Return the full MemoryFileWithMeta for a named memory, or null if not found. */
  readFull(featureName: string, fileName: string): MemoryFileWithMeta | null;
  /** Global memory (not feature-scoped). */
  writeGlobal(fileName: string, content: string): string;
  readGlobal(fileName: string): string | null;
  listGlobal(): MemoryFile[];
  deleteGlobal(fileName: string): boolean;
}
