/**
 * BrTaskAdapter -- TaskPort implementation backed by br (beads_rust) CLI.
 *
 * Status mapping (maestro <-> br):
 *   pending      <-> open
 *   in_progress  <-> in_progress (notes != "partial:")
 *   done         <-> closed (no close_reason)
 *   blocked      <-> deferred
 *   cancelled    <-> closed (close_reason=cancelled)
 *   failed       <-> closed (close_reason=failed)
 *   partial      <-> in_progress (notes starts with "partial:")
 *
 * All br queries are scoped by label `feature:<name>`.
 * Folder-to-ID mapping stored in `.hive/features/<name>/br-mapping.json`.
 */

import type { TaskInfo, TaskStatusType } from '../types.ts';
import type { TaskPort, CreateOpts, UpdateFields, ListOpts } from '../ports/tasks.ts';
import { isValidTransition, VALID_TRANSITIONS } from '../ports/tasks.ts';
import { MaestroError } from '../lib/errors.ts';
import { readJson, writeJson, ensureDir, getFeaturePath } from '../utils/paths.ts';
import * as path from 'path';

const SQLITE_BUSY_EXIT = 5;
const RETRY_DELAYS = [100, 300, 1000];
const PARTIAL_PREFIX = 'partial:';

interface BrIssue {
  id: number;
  title: string;
  status: string;          // open | in_progress | deferred | closed
  labels?: string[];
  description?: string;
  notes?: string;
  close_reason?: string;
  dependencies?: number[];
  parent_id?: number;
}

interface BrMapping {
  /** folder name -> br issue ID */
  folderToId: Record<string, number>;
  /** br issue ID -> folder name */
  idToFolder: Record<string, string>;
}

export class BrTaskAdapter implements TaskPort {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  // --------------------------------------------------------------------------
  // TaskPort implementation
  // --------------------------------------------------------------------------

  async create(feature: string, title: string, opts?: CreateOpts): Promise<TaskInfo> {
    const args = ['create', '--title', title, '-l', `feature:${feature}`];
    if (opts?.parent) args.push('--parent', String(this.resolveBrId(feature, opts.parent)));
    if (opts?.deps) {
      for (const dep of opts.deps) {
        const depId = this.resolveBrId(feature, dep);
        args.push('--deps', `blocks:${depId}`);
      }
    }
    if (opts?.description) args.push('--description', opts.description);
    args.push('--json');

    const issue = await this.exec<BrIssue>(args);
    const folder = this.titleToFolder(title, issue.id);

    this.saveMappingEntry(feature, folder, issue.id);

    return this.toTaskInfo(issue, folder);
  }

  async update(feature: string, id: string, fields: UpdateFields): Promise<TaskInfo> {
    const brId = this.resolveBrId(feature, id);

    // Enforce state machine if status change requested
    if (fields.status) {
      const current = await this.get(feature, id);
      if (current && !isValidTransition(current.status, fields.status)) {
        throw new MaestroError(
          `Invalid status transition: ${current.status} -> ${fields.status}`,
          [`Valid transitions from '${current.status}': ${this.validTargets(current.status).join(', ')}`]
        );
      }
    }

    const args = ['update', String(brId)];

    if (fields.status) {
      const brStatus = this.toBrWriteStatus(fields.status);
      if (brStatus === 'close') {
        return this.closeAndReturn(feature, id, fields.status === 'cancelled' ? 'cancelled' : fields.status === 'failed' ? 'failed' : undefined);
      }
      args.push('-s', brStatus);
    }

    if (fields.description) args.push('--description', fields.description);

    if (fields.status === 'partial') {
      // Always encode partial prefix so toMaestroStatus() can detect it
      args.push('--notes', `${PARTIAL_PREFIX}${fields.notes || ''}`);
    } else if (fields.notes) {
      args.push('--notes', fields.notes);
    }

    if (fields.baseCommit) {
      // Store baseCommit in notes metadata
      const existingNotes = (await this.getBrIssue(brId))?.notes || '';
      const newNotes = this.appendMetadata(existingNotes, 'baseCommit', fields.baseCommit);
      args.push('--notes', newNotes);
    }

    args.push('--json');
    const issue = await this.exec<BrIssue>(args);
    return this.toTaskInfo(issue, id);
  }

  async get(feature: string, id: string): Promise<TaskInfo | null> {
    try {
      const brId = this.resolveBrId(feature, id);
      const issue = await this.getBrIssue(brId);
      if (!issue) return null;
      return this.toTaskInfo(issue, id);
    } catch {
      return null;
    }
  }

  async list(feature: string, opts?: ListOpts): Promise<TaskInfo[]> {
    const args = ['list', '-l', `feature:${feature}`];
    if (opts?.status) {
      args.push('-s', this.toBrReadFilter(opts.status));
    }
    if (opts?.includeAll) {
      args.push('--all', '--deferred');
    }
    args.push('--json', '--limit', '0');

    const issues = await this.exec<BrIssue[]>(args);
    return this.mapIssuesToTasks(feature, issues);
  }

  async close(feature: string, id: string, reason?: string): Promise<{ suggestNext?: string[] }> {
    const brId = this.resolveBrId(feature, id);
    const args = ['close', String(brId)];
    if (reason) args.push('-r', reason);
    args.push('--suggest-next', '--json');

    const result = await this.exec<{ suggest_next?: number[] }>(args);
    const mapping = this.getMapping(feature);

    const suggestNext = result.suggest_next?.map(nextId =>
      mapping.idToFolder[String(nextId)]
    ).filter((f): f is string => f !== undefined);

    return { suggestNext };
  }

  async addDependency(feature: string, taskId: string, dependsOnId: string): Promise<void> {
    const brTaskId = this.resolveBrId(feature, taskId);
    const brDepId = this.resolveBrId(feature, dependsOnId);
    await this.exec(['dep', 'add', String(brTaskId), String(brDepId)]);
  }

  async getRunnable(feature: string): Promise<TaskInfo[]> {
    const args = ['ready', '-l', `feature:${feature}`, '--json', '--limit', '0'];
    const issues = await this.exec<BrIssue[]>(args);
    return this.mapIssuesToTasks(feature, issues);
  }

  async getBlocked(feature: string): Promise<Record<string, string[]>> {
    const args = ['blocked', '-l', `feature:${feature}`, '--json', '--limit', '0'];
    const issues = await this.exec<Array<BrIssue & { blocked_by?: number[] }>>(args);
    const mapping = this.getMapping(feature);
    const result: Record<string, string[]> = {};

    for (const issue of issues) {
      const folder = mapping.idToFolder[String(issue.id)] || `unknown-${issue.id}`;
      const blockers = (issue.blocked_by || issue.dependencies || []).map(depId =>
        mapping.idToFolder[String(depId)] || `unknown-${depId}`
      );
      result[folder] = blockers;
    }

    return result;
  }

  async readSpec(feature: string, id: string): Promise<string | null> {
    const issue = await this.getBrIssue(this.resolveBrId(feature, id));
    return issue?.description || null;
  }

  async writeSpec(feature: string, id: string, content: string): Promise<void> {
    const brId = this.resolveBrId(feature, id);
    await this.exec(['update', String(brId), '--description', content]);
  }

  async readReport(feature: string, id: string): Promise<string | null> {
    const issue = await this.getBrIssue(this.resolveBrId(feature, id));
    if (!issue?.notes) return null;
    // Strip partial prefix and metadata
    return this.stripMetadata(issue.notes.replace(new RegExp(`^${PARTIAL_PREFIX}`), ''));
  }

  async writeReport(feature: string, id: string, content: string): Promise<void> {
    const brId = this.resolveBrId(feature, id);
    await this.exec(['update', String(brId), '--notes', content]);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.exec(['--version']);
      return true;
    } catch {
      return false;
    }
  }

  installHint(): string {
    return 'br (beads_rust) is required. Install: cargo install beads_rust';
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private async exec<T = unknown>(args: string[]): Promise<T> {
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        const proc = Bun.spawn(['br', ...args], {
          cwd: this.projectRoot,
          stdout: 'pipe',
          stderr: 'pipe',
        });

        const [exitCode, stdout, stderr] = await Promise.all([
          proc.exited,
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ]);

        if (exitCode === 0) {
          try {
            return JSON.parse(stdout) as T;
          } catch {
            return stdout as unknown as T;
          }
        }

        if (exitCode === SQLITE_BUSY_EXIT && attempt < RETRY_DELAYS.length) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
          continue;
        }

        throw new MaestroError(
          `br command failed (exit ${exitCode}): ${stderr.trim() || stdout.trim()}`,
          exitCode === SQLITE_BUSY_EXIT ? ['SQLite database locked. Retry or check for other br processes.'] : []
        );
      } catch (err) {
        if (err instanceof MaestroError) throw err;

        const error = err as NodeJS.ErrnoException;
        if (error.code === 'ENOENT') {
          throw new MaestroError(
            'br not found',
            [this.installHint()]
          );
        }
        throw err;
      }
    }

    throw new MaestroError('br command failed after retries');
  }

  private async getBrIssue(brId: number): Promise<BrIssue | null> {
    try {
      return await this.exec<BrIssue>(['show', String(brId), '--json']);
    } catch {
      return null;
    }
  }

  private async closeAndReturn(feature: string, id: string, reason?: string): Promise<TaskInfo> {
    await this.close(feature, id, reason);
    const result = await this.get(feature, id);
    if (!result) throw new MaestroError(`Task ${id} not found after close`);
    return result;
  }

  // --------------------------------------------------------------------------
  // Status mapping
  // --------------------------------------------------------------------------

  private toMaestroStatus(issue: BrIssue): TaskStatusType {
    switch (issue.status) {
      case 'open': return 'pending';
      case 'in_progress':
        if (issue.notes?.startsWith(PARTIAL_PREFIX)) return 'partial';
        return 'in_progress';
      case 'deferred': return 'blocked';
      case 'closed':
        if (issue.close_reason === 'cancelled') return 'cancelled';
        if (issue.close_reason === 'failed') return 'failed';
        return 'done';
      default: return 'pending';
    }
  }

  private toBrWriteStatus(status: TaskStatusType): string {
    switch (status) {
      case 'pending': return 'open';
      case 'in_progress': return 'in_progress';
      case 'blocked': return 'deferred';
      case 'partial': return 'in_progress';
      case 'done': return 'close';
      case 'cancelled': return 'close';
      case 'failed': return 'close';
      default: return 'open';
    }
  }

  private toBrReadFilter(status: TaskStatusType): string {
    switch (status) {
      case 'pending': return 'open';
      case 'in_progress': return 'in_progress';
      case 'blocked': return 'deferred';
      case 'done': return 'closed';
      default: return 'open';
    }
  }

  private validTargets(status: TaskStatusType): string[] {
    return VALID_TRANSITIONS[status] || [];
  }

  // --------------------------------------------------------------------------
  // Mapping: folder <-> br issue ID
  // --------------------------------------------------------------------------

  private getMappingPath(feature: string): string {
    return path.join(getFeaturePath(this.projectRoot, feature), 'br-mapping.json');
  }

  private getMapping(feature: string): BrMapping {
    const mappingPath = this.getMappingPath(feature);
    return readJson<BrMapping>(mappingPath) || { folderToId: {}, idToFolder: {} };
  }

  private saveMappingEntry(feature: string, folder: string, brId: number): void {
    const mappingPath = this.getMappingPath(feature);
    ensureDir(path.dirname(mappingPath));
    const mapping = this.getMapping(feature);
    mapping.folderToId[folder] = brId;
    mapping.idToFolder[String(brId)] = folder;
    writeJson(mappingPath, mapping);
  }

  private resolveBrId(feature: string, folderOrId: string): number {
    // If it's already a number, use directly
    const asNum = parseInt(folderOrId, 10);
    if (!isNaN(asNum) && String(asNum) === folderOrId) return asNum;

    const mapping = this.getMapping(feature);
    const brId = mapping.folderToId[folderOrId];
    if (brId === undefined) {
      throw new MaestroError(
        `No br mapping for task '${folderOrId}' in feature '${feature}'`,
        ['Run maestro task-sync to create tasks from the plan']
      );
    }
    return brId;
  }

  // --------------------------------------------------------------------------
  // Conversion helpers
  // --------------------------------------------------------------------------

  /** Map a batch of br issues to TaskInfo using a single mapping read. */
  private mapIssuesToTasks(feature: string, issues: BrIssue[]): TaskInfo[] {
    const mapping = this.getMapping(feature);
    return issues.map(issue => {
      const folder = mapping.idToFolder[String(issue.id)] || `unknown-${issue.id}`;
      return this.toTaskInfo(issue, folder, mapping);
    });
  }

  private toTaskInfo(issue: BrIssue, folder: string, mapping?: BrMapping): TaskInfo {
    return {
      folder,
      name: folder.replace(/^\d+-/, ''),
      status: this.toMaestroStatus(issue),
      origin: 'plan',
      planTitle: issue.title,
      summary: issue.notes?.replace(new RegExp(`^${PARTIAL_PREFIX}`), '') || undefined,
      dependsOn: issue.dependencies?.map(depId =>
        mapping?.idToFolder[String(depId)] || `unknown-${depId}`
      ),
    };
  }

  private titleToFolder(title: string, id: number): string {
    const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `${String(id).padStart(2, '0')}-${slug}`;
  }

  // --------------------------------------------------------------------------
  // Notes metadata encoding
  // --------------------------------------------------------------------------

  private appendMetadata(notes: string, key: string, value: string): string {
    const metaLine = `\n<!-- ${key}:${value} -->`;
    return notes + metaLine;
  }

  private stripMetadata(notes: string): string {
    return notes.replace(/\n<!-- \w+:.+ -->/g, '').trim();
  }
}
