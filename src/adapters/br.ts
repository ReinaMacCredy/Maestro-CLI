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
 * Folder-to-ID mapping stored in `.maestro/features/<name>/br-mapping.json`.
 */

import type { TaskInfo, TaskStatusType } from '../types.ts';
import type { TaskPort, CreateOpts, UpdateFields, ListOpts } from '../ports/tasks.ts';
import { isValidTransition, VALID_TRANSITIONS } from '../ports/tasks.ts';
import { MaestroError } from '../lib/errors.ts';
import { getFeaturePath } from '../utils/paths.ts';
import { readJson, writeJson, ensureDir } from '../utils/fs-io.ts';
import * as path from 'path';

/** br returns exit code 5 when its database is locked (transient). */
const TRANSIENT_EXIT_CODE = 5;
const RETRY_DELAYS = [100, 300, 1000];
const PARTIAL_PREFIX = 'partial:';
const METADATA_RE = /\n<!-- (\w+):(.+) -->/g;

const BR_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  DEFERRED: 'deferred',
  CLOSED: 'closed',
} as const;
type BrStatus = typeof BR_STATUS[keyof typeof BR_STATUS];

interface BrIssue {
  id: number;
  title: string;
  status: BrStatus;
  labels?: string[];
  description?: string;
  notes?: string;
  close_reason?: string;
  dependencies?: number[];
  parent_id?: number;
}

interface DecodedNotes {
  content: string;
  isPartial: boolean;
  metadata: Record<string, string>;
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
      const issue = await this.getBrIssue(brId);
      if (issue) {
        const currentStatus = this.toMaestroStatus(issue);
        if (!isValidTransition(currentStatus, fields.status)) {
          throw new MaestroError(
            `Invalid status transition: ${currentStatus} -> ${fields.status}`,
            [`Valid transitions from '${currentStatus}': ${this.validTargets(currentStatus).join(', ')}`]
          );
        }
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

    if (fields.status === 'partial' || fields.notes || fields.baseCommit) {
      const metadata: Record<string, string> = {};
      if (fields.baseCommit) metadata.baseCommit = fields.baseCommit;
      args.push('--notes', this.encodeNotes({
        isPartial: fields.status === 'partial',
        content: fields.notes || '',
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      }));
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
    return this.decodeNotes(issue.notes).content || null;
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

        if (exitCode === TRANSIENT_EXIT_CODE && attempt < RETRY_DELAYS.length) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
          continue;
        }

        throw new MaestroError(
          `br command failed (exit ${exitCode}): ${stderr.trim() || stdout.trim()}`,
          exitCode === TRANSIENT_EXIT_CODE ? ['Database locked. Retry or check for other br processes.'] : []
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
      case BR_STATUS.OPEN: return 'pending';
      case BR_STATUS.IN_PROGRESS:
        return this.decodeNotes(issue.notes).isPartial ? 'partial' : 'in_progress';
      case BR_STATUS.DEFERRED: return 'blocked';
      case BR_STATUS.CLOSED:
        if (issue.close_reason === 'cancelled') return 'cancelled';
        if (issue.close_reason === 'failed') return 'failed';
        return 'done';
      default: return 'pending';
    }
  }

  private toBrWriteStatus(status: TaskStatusType): BrStatus | 'close' {
    switch (status) {
      case 'pending': return BR_STATUS.OPEN;
      case 'in_progress': return BR_STATUS.IN_PROGRESS;
      case 'blocked': return BR_STATUS.DEFERRED;
      case 'partial': return BR_STATUS.IN_PROGRESS;
      case 'done': return 'close';
      case 'cancelled': return 'close';
      case 'failed': return 'close';
      default: return BR_STATUS.OPEN;
    }
  }

  private toBrReadFilter(status: TaskStatusType): BrStatus {
    switch (status) {
      case 'pending': return BR_STATUS.OPEN;
      case 'in_progress': return BR_STATUS.IN_PROGRESS;
      case 'blocked': return BR_STATUS.DEFERRED;
      case 'done': return BR_STATUS.CLOSED;
      default: return BR_STATUS.OPEN;
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
    const decoded = this.decodeNotes(issue.notes);
    return {
      folder,
      name: folder.replace(/^\d+-/, ''),
      status: this.toMaestroStatus(issue),
      origin: 'plan',
      planTitle: issue.title,
      summary: decoded.content || undefined,
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
  // Notes codec: all partial-prefix and metadata encoding in one place
  // --------------------------------------------------------------------------

  /** Encode maestro state into br's notes field. */
  private encodeNotes(opts: { isPartial: boolean; content: string; metadata?: Record<string, string> }): string {
    let encoded = opts.isPartial ? `${PARTIAL_PREFIX}${opts.content}` : opts.content;
    if (opts.metadata) {
      for (const [key, value] of Object.entries(opts.metadata)) {
        encoded += `\n<!-- ${key}:${value} -->`;
      }
    }
    return encoded;
  }

  /** Decode br's raw notes back into maestro state. */
  private decodeNotes(raw: string | undefined): DecodedNotes {
    if (!raw) return { content: '', isPartial: false, metadata: {} };
    const metadata: Record<string, string> = {};
    let stripped = raw.replace(METADATA_RE, (_, key, value) => {
      metadata[key] = value;
      return '';
    }).trim();
    const isPartial = stripped.startsWith(PARTIAL_PREFIX);
    if (isPartial) stripped = stripped.slice(PARTIAL_PREFIX.length);
    return { content: stripped, isPartial, metadata };
  }
}
