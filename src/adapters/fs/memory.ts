/**
 * Filesystem-based memory adapter for maestroCLI.
 * Supports both per-feature memory (.maestro/features/<name>/memory/)
 * and global memory (.maestro/memory/).
 */

import * as fs from 'fs';
import * as path from 'path';
import { getMemoryPath, getGlobalMemoryPath } from '../../utils/paths.ts';
import { ensureDir, fileExists, readText, writeText } from '../../utils/fs-io.ts';
import type { MemoryFile, MemoryFileWithMeta, MemoryMetadata } from '../../types.ts';
import type { MemoryPort } from '../../ports/memory.ts';
import { parseFrontmatterRich, stripFrontmatter } from '../../utils/frontmatter.ts';
import { inferMetadata } from '../../utils/memory-inference.ts';

export class FsMemoryAdapter implements MemoryPort {
  constructor(private projectRoot: string) {}

  write(featureName: string, fileName: string, content: string): string {
    const memoryPath = getMemoryPath(this.projectRoot, featureName);
    return this._write(memoryPath, fileName, content);
  }

  read(featureName: string, fileName: string): string | null {
    const memoryPath = getMemoryPath(this.projectRoot, featureName);
    const filePath = path.join(memoryPath, this.normalizeFileName(fileName));
    return readText(filePath);
  }

  list(featureName: string): MemoryFile[] {
    const memoryPath = getMemoryPath(this.projectRoot, featureName);
    return this._list(memoryPath);
  }

  listWithMeta(featureName: string): MemoryFileWithMeta[] {
    const files = this.list(featureName);
    return files.map(f => this._enrichWithMeta(f));
  }

  delete(featureName: string, fileName: string): boolean {
    const memoryPath = getMemoryPath(this.projectRoot, featureName);
    const filePath = path.join(memoryPath, this.normalizeFileName(fileName));

    if (fileExists(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  compile(featureName: string): string {
    const files = this.list(featureName);
    if (files.length === 0) return '';

    const sections = files.map(f => `## ${f.name}\n\n${f.content}`);
    return sections.join('\n\n---\n\n');
  }

  archive(featureName: string): { archived: string[]; archivePath: string } {
    const memories = this.list(featureName);
    if (memories.length === 0) return { archived: [], archivePath: '' };

    const memoryPath = getMemoryPath(this.projectRoot, featureName);
    const archiveDir = path.join(memoryPath, '..', 'archive');
    ensureDir(archiveDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archived: string[] = [];

    for (const mem of memories) {
      const archiveName = `${timestamp}_${mem.name}.md`;
      const src = path.join(memoryPath, `${mem.name}.md`);
      const dest = path.join(archiveDir, archiveName);
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
      archived.push(mem.name);
    }

    return { archived, archivePath: archiveDir };
  }

  stats(featureName: string): { count: number; totalBytes: number; oldest?: string; newest?: string } {
    const memoryPath = getMemoryPath(this.projectRoot, featureName);
    return this._stats(memoryPath);
  }

  deleteGlobal(fileName: string): boolean {
    const globalPath = getGlobalMemoryPath(this.projectRoot);
    const filePath = path.join(globalPath, this.normalizeFileName(fileName));

    if (fileExists(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  // -- Global memory (project-scoped, not feature-scoped) --

  writeGlobal(fileName: string, content: string): string {
    const globalPath = getGlobalMemoryPath(this.projectRoot);
    return this._write(globalPath, fileName, content);
  }

  readGlobal(fileName: string): string | null {
    const globalPath = getGlobalMemoryPath(this.projectRoot);
    const filePath = path.join(globalPath, this.normalizeFileName(fileName));
    return readText(filePath);
  }

  listGlobal(): MemoryFile[] {
    const globalPath = getGlobalMemoryPath(this.projectRoot);
    return this._list(globalPath);
  }

  // -- Shared helpers --

  private _write(dir: string, fileName: string, content: string): string {
    ensureDir(dir);
    const filePath = path.join(dir, this.normalizeFileName(fileName));
    writeText(filePath, content);

    const totalBytes = this._totalSize(dir);
    if (totalBytes > 20000) {
      return `${filePath}\n\n[warn] Memory total: ~${totalBytes} bytes (exceeds 20,000). Consider archiving older memories with memory-archive.`;
    }

    return filePath;
  }

  private _list(dir: string): MemoryFile[] {
    if (!fileExists(dir)) return [];

    const files = fs.readdirSync(dir, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.endsWith('.md'))
      .map(f => f.name);

    return files.map(name => {
      const filePath = path.join(dir, name);
      const stat = fs.statSync(filePath);
      const content = readText(filePath) || '';
      return {
        name: name.replace(/\.md$/, ''),
        content,
        updatedAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
      };
    });
  }

  private _stats(dir: string): { count: number; totalBytes: number; oldest?: string; newest?: string } {
    if (!fileExists(dir)) return { count: 0, totalBytes: 0 };

    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.endsWith('.md'))
      .map(f => {
        const stat = fs.statSync(path.join(dir, f.name));
        return { name: f.name.replace(/\.md$/, ''), size: stat.size, mtime: stat.mtime.getTime() };
      });

    if (entries.length === 0) return { count: 0, totalBytes: 0 };

    entries.sort((a, b) => a.mtime - b.mtime);

    return {
      count: entries.length,
      totalBytes: entries.reduce((sum, e) => sum + e.size, 0),
      oldest: entries[0].name,
      newest: entries[entries.length - 1].name,
    };
  }

  private _totalSize(dir: string): number {
    if (!fileExists(dir)) return 0;
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.endsWith('.md'))
      .reduce((sum, f) => sum + fs.statSync(path.join(dir, f.name)).size, 0);
  }

  private _enrichWithMeta(file: MemoryFile): MemoryFileWithMeta {
    const bodyContent = stripFrontmatter(file.content);
    const parsed = parseFrontmatterRich(file.content);

    // Short-circuit: skip inference when frontmatter provides all fields
    if (parsed && Array.isArray(parsed.tags) && typeof parsed.priority === 'number' && typeof parsed.category === 'string') {
      return {
        ...file, bodyContent,
        metadata: { tags: parsed.tags as string[], priority: parsed.priority, category: parsed.category as MemoryMetadata['category'] },
      };
    }

    const inferred = inferMetadata(bodyContent, file.name);
    const metadata: MemoryMetadata = {
      tags: parsed && Array.isArray(parsed.tags) ? parsed.tags as string[] : inferred.tags,
      priority: parsed && typeof parsed.priority === 'number' ? parsed.priority : inferred.priority,
      category: parsed && typeof parsed.category === 'string'
        ? parsed.category as MemoryMetadata['category']
        : inferred.category,
    };

    return { ...file, metadata, bodyContent };
  }

  private normalizeFileName(name: string): string {
    const normalized = name.replace(/\.md$/, '');
    return `${normalized}.md`;
  }
}
