/**
 * Filesystem-based context adapter for maestroCLI.
 * Forked from hive-core/src/services/contextService.ts.
 * Adapted: stripped emoji from warning message.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getContextPath } from '../utils/paths.ts';
import { ensureDir, fileExists, readText, writeText } from '../utils/fs-io.ts';
import type { ContextFile } from '../types.ts';

export class FsContextAdapter {
  constructor(private projectRoot: string) {}

  write(featureName: string, fileName: string, content: string): string {
    const contextPath = getContextPath(this.projectRoot, featureName);
    ensureDir(contextPath);

    const filePath = path.join(contextPath, this.normalizeFileName(fileName));
    writeText(filePath, content);

    const totalBytes = this.totalSize(featureName);
    if (totalBytes > 20000) {
      return `${filePath}\n\n[warn] Context total: ~${totalBytes} bytes (exceeds 20,000). Consider archiving older contexts with context-archive.`;
    }

    return filePath;
  }

  read(featureName: string, fileName: string): string | null {
    const contextPath = getContextPath(this.projectRoot, featureName);
    const filePath = path.join(contextPath, this.normalizeFileName(fileName));
    return readText(filePath);
  }

  list(featureName: string): ContextFile[] {
    const contextPath = getContextPath(this.projectRoot, featureName);
    if (!fileExists(contextPath)) return [];

    const files = fs.readdirSync(contextPath, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.endsWith('.md'))
      .map(f => f.name);

    return files.map(name => {
      const filePath = path.join(contextPath, name);
      const stat = fs.statSync(filePath);
      const content = readText(filePath) || '';
      return {
        name: name.replace(/\.md$/, ''),
        content,
        updatedAt: stat.mtime.toISOString(),
      };
    });
  }

  delete(featureName: string, fileName: string): boolean {
    const contextPath = getContextPath(this.projectRoot, featureName);
    const filePath = path.join(contextPath, this.normalizeFileName(fileName));

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
    const contexts = this.list(featureName);
    if (contexts.length === 0) return { archived: [], archivePath: '' };

    const contextPath = getContextPath(this.projectRoot, featureName);
    const archiveDir = path.join(contextPath, '..', 'archive');
    ensureDir(archiveDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archived: string[] = [];

    for (const ctx of contexts) {
      const archiveName = `${timestamp}_${ctx.name}.md`;
      const src = path.join(contextPath, `${ctx.name}.md`);
      const dest = path.join(archiveDir, archiveName);
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
      archived.push(ctx.name);
    }

    return { archived, archivePath: archiveDir };
  }

  stats(featureName: string): { count: number; totalBytes: number; oldest?: string; newest?: string } {
    const contextPath = getContextPath(this.projectRoot, featureName);
    if (!fileExists(contextPath)) return { count: 0, totalBytes: 0 };

    const entries = fs.readdirSync(contextPath, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.endsWith('.md'))
      .map(f => {
        const stat = fs.statSync(path.join(contextPath, f.name));
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

  /** Sum file sizes using stat only (no content reads). */
  private totalSize(featureName: string): number {
    const contextPath = getContextPath(this.projectRoot, featureName);
    if (!fileExists(contextPath)) return 0;
    return fs.readdirSync(contextPath, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.endsWith('.md'))
      .reduce((sum, f) => sum + fs.statSync(path.join(contextPath, f.name)).size, 0);
  }

  private normalizeFileName(name: string): string {
    const normalized = name.replace(/\.md$/, '');
    return `${normalized}.md`;
  }
}
