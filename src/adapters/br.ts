/**
 * BrTaskAdapter -- TaskPort implementation backed by br (beads_rust) CLI.
 *
 * Status mapping (maestro 4-state <-> br):
 *   pending  <-> open
 *   claimed  <-> in_progress
 *   done     <-> closed
 *   blocked  <-> deferred
 *
 * All br queries are scoped by label `feature:<name>`.
 * Folder-to-ID mapping stored in `.maestro/features/<name>/br-mapping.json`.
 */

import type { TaskInfo, TaskStatusType } from '../types.ts';
import type { TaskPort, CreateOpts, ListOpts } from '../ports/tasks.ts';
import { MaestroError } from '../lib/errors.ts';
import { getFeaturePath, getTaskReportPath } from '../utils/paths.ts';
import { readJson, writeJson, ensureDir, readText, writeText } from '../utils/fs-io.ts';
import * as path from 'path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** br returns exit code 5 when its database is locked (transient). */
const TRANSIENT_EXIT_CODE = 5;
const RETRY_DELAYS = [100, 300, 1000];

const BR_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  DEFERRED: 'deferred',
  CLOSED: 'closed',
} as const;
type BrStatus = typeof BR_STATUS[keyof typeof BR_STATUS];

interface BrIssue {
  id: number | string;
  title: string;
  status: BrStatus;
  labels?: string[];
  description?: string;
  notes?: string;
  close_reason?: string;
  dependencies?: number[];
}

interface BrMapping {
  /** folder name -> br issue ID */
  folderToId: Record<string, number | string>;
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
    if (opts?.deps) {
      for (const dep of opts.deps) {
        const depId = this.resolveBrId(feature, dep);
        args.push('--deps', `blocks:${depId}`);
      }
    }
    if (opts?.description) args.push('--description', opts.description);
    args.push('--json');

    const raw = await this.exec<BrIssue | BrIssue[]>(args);
    const issue = Array.isArray(raw) ? raw[0] : raw;
    const folder = this.titleToFolder(title, issue.id);

    this.saveMappingEntry(feature, folder, issue.id);

    return this.toTaskInfo(issue, folder);
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

  async remove(feature: string, id: string): Promise<void> {
    const brId = this.resolveBrId(feature, id);
    await this.exec(['close', String(brId), '-r', 'removed']);
  }

  async claim(feature: string, id: string, agentId: string): Promise<TaskInfo> {
    const brId = this.resolveBrId(feature, id);
    await this.exec(['update', String(brId), '-s', 'in_progress', '--notes', `claimed by ${agentId}`]);
    const result = await this.get(feature, id);
    if (!result) throw new MaestroError(`Task '${id}' not found after claim`);
    return result;
  }

  async done(feature: string, id: string, summary: string): Promise<TaskInfo> {
    const brId = this.resolveBrId(feature, id);
    await this.exec(['update', String(brId), '--notes', summary]);
    await this.exec(['close', String(brId)]);
    const result = await this.get(feature, id);
    if (!result) throw new MaestroError(`Task '${id}' not found after done`);
    return result;
  }

  async block(feature: string, id: string, reason: string): Promise<TaskInfo> {
    const brId = this.resolveBrId(feature, id);
    await this.exec(['update', String(brId), '-s', 'deferred', '--notes', reason]);
    const result = await this.get(feature, id);
    if (!result) throw new MaestroError(`Task '${id}' not found after block`);
    return result;
  }

  async unblock(feature: string, id: string, decision: string): Promise<TaskInfo> {
    const brId = this.resolveBrId(feature, id);
    await this.exec(['update', String(brId), '-s', 'open', '--notes', `unblocked: ${decision}`]);
    const result = await this.get(feature, id);
    if (!result) throw new MaestroError(`Task '${id}' not found after unblock`);
    return result;
  }

  async getRunnable(feature: string): Promise<TaskInfo[]> {
    const args = ['ready', '-l', `feature:${feature}`, '--json', '--limit', '0'];
    const issues = await this.exec<BrIssue[]>(args);
    return this.mapIssuesToTasks(feature, issues);
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
    const reportPath = getTaskReportPath(this.projectRoot, feature, this.resolveTaskFolder(feature, id));
    const sidecarReport = readText(reportPath);
    if (sidecarReport !== null) {
      return sidecarReport;
    }

    const issue = await this.getBrIssue(this.resolveBrId(feature, id));
    if (!issue?.notes) return null;
    return issue.notes.startsWith('# Task Report:') ? issue.notes : null;
  }

  async writeReport(feature: string, id: string, content: string): Promise<void> {
    const reportPath = getTaskReportPath(this.projectRoot, feature, this.resolveTaskFolder(feature, id));
    writeText(reportPath, content);
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private async exec<T = unknown>(args: string[]): Promise<T> {
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        const { stdout } = await execFileAsync('br', args, {
          cwd: this.projectRoot,
          maxBuffer: 10 * 1024 * 1024,
        });

        try {
          return JSON.parse(stdout) as T;
        } catch {
          return stdout as unknown as T;
        }
      } catch (err) {
        if (err instanceof MaestroError) throw err;

        const error = err as NodeJS.ErrnoException & { code?: string; exitCode?: number; status?: number; stdout?: string; stderr?: string };

        if (error.code === 'ENOENT') {
          throw new MaestroError(
            'br not found',
            ['br (beads_rust) is required. Install: cargo install beads_rust']
          );
        }

        const exitCode = error.exitCode ?? error.status ?? 1;
        const stdout = error.stdout || '';
        const stderr = error.stderr || '';

        if (exitCode === TRANSIENT_EXIT_CODE && attempt < RETRY_DELAYS.length) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
          continue;
        }

        throw new MaestroError(
          `br command failed (exit ${exitCode}): ${stderr.trim() || stdout.trim()}`,
          exitCode === TRANSIENT_EXIT_CODE ? ['Database locked. Retry or check for other br processes.'] : []
        );
      }
    }

    throw new MaestroError('br command failed after retries');
  }

  private async getBrIssue(brId: number | string): Promise<BrIssue | null> {
    try {
      const result = await this.exec<BrIssue | BrIssue[]>(['show', String(brId), '--json']);
      return Array.isArray(result) ? (result[0] ?? null) : result;
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Status mapping (4-state)
  // --------------------------------------------------------------------------

  private toMaestroStatus(issue: BrIssue): TaskStatusType {
    switch (issue.status) {
      case BR_STATUS.OPEN: return 'pending';
      case BR_STATUS.IN_PROGRESS: return 'claimed';
      case BR_STATUS.DEFERRED: return 'blocked';
      case BR_STATUS.CLOSED: return 'done';
      default: return 'pending';
    }
  }

  private toBrReadFilter(status: TaskStatusType): BrStatus {
    switch (status) {
      case 'pending': return BR_STATUS.OPEN;
      case 'claimed': return BR_STATUS.IN_PROGRESS;
      case 'blocked': return BR_STATUS.DEFERRED;
      case 'done': return BR_STATUS.CLOSED;
      default: return BR_STATUS.OPEN;
    }
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

  private saveMappingEntry(feature: string, folder: string, brId: number | string): void {
    const mappingPath = this.getMappingPath(feature);
    ensureDir(path.dirname(mappingPath));
    const mapping = this.getMapping(feature);
    mapping.folderToId[folder] = brId;
    mapping.idToFolder[String(brId)] = folder;
    writeJson(mappingPath, mapping);
  }

  private resolveBrId(feature: string, folderOrId: string): number | string {
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

  private resolveTaskFolder(feature: string, folderOrId: string): string {
    const mapping = this.getMapping(feature);
    if (mapping.folderToId[folderOrId] !== undefined) {
      return folderOrId;
    }

    const asNum = parseInt(folderOrId, 10);
    if (!isNaN(asNum)) {
      return mapping.idToFolder[String(asNum)] || folderOrId;
    }

    return folderOrId;
  }

  // --------------------------------------------------------------------------
  // Conversion helpers
  // --------------------------------------------------------------------------

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
      summary: issue.notes || undefined,
      dependsOn: issue.dependencies?.map(depId =>
        mapping?.idToFolder[String(depId)] || `unknown-${depId}`
      ),
    };
  }

  private titleToFolder(title: string, id: number | string): string {
    const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `${String(id).padStart(2, '0')}-${slug}`;
  }
}
