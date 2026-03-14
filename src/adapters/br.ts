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

import type { TaskInfo, TaskStatusType, WorkerSession } from '../types.ts';
import type { TaskPort, CreateOpts, UpdateFields, ListOpts } from '../ports/tasks.ts';
import { isValidTransition, VALID_TRANSITIONS } from '../ports/tasks.ts';
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
    const currentIssue = await this.getBrIssue(brId);
    const currentDecoded = this.decodeNotes(currentIssue?.notes);

    // Enforce state machine if status change requested
    if (fields.status) {
      if (currentIssue) {
        const currentStatus = this.toMaestroStatus(currentIssue);
        if (!isValidTransition(currentStatus, fields.status)) {
          throw new MaestroError(
            `Invalid status transition: ${currentStatus} -> ${fields.status}`,
            [`Valid transitions from '${currentStatus}': ${this.validTargets(currentStatus).join(', ')}`]
          );
        }
      }
    }

    const args = ['update', String(brId)];
    const nextIsPartial = fields.status
      ? fields.status === 'partial'
      : currentDecoded.isPartial;
    const metadata = this.mergeMetadata(currentDecoded.metadata, fields);
    const nextContent = fields.summary ?? fields.notes ?? currentDecoded.content;
    const shouldWriteNotes =
      fields.notes !== undefined ||
      fields.summary !== undefined ||
      fields.baseCommit !== undefined ||
      fields.startedAt !== undefined ||
      fields.completedAt !== undefined ||
      fields.workerSession !== undefined ||
      currentDecoded.isPartial !== nextIsPartial;

    if (fields.status) {
      const brStatus = this.toBrWriteStatus(fields.status);
      if (brStatus === 'close') {
        if (fields.description) args.push('--description', fields.description);
        if (shouldWriteNotes) {
          args.push('--notes', this.encodeNotes({
            isPartial: nextIsPartial,
            content: nextContent,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          }));
        }
        if (args.length > 2) {
          args.push('--json');
          await this.exec<BrIssue>(args);
        }
        return this.closeAndReturn(
          feature,
          id,
          fields.status === 'cancelled'
            ? 'cancelled'
            : fields.status === 'failed'
              ? 'failed'
              : undefined,
        );
      }
      args.push('-s', brStatus);
    }

    if (fields.description) args.push('--description', fields.description);

    if (shouldWriteNotes) {
      args.push('--notes', this.encodeNotes({
        isPartial: nextIsPartial,
        content: nextContent,
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
    const reportPath = getTaskReportPath(this.projectRoot, feature, this.resolveTaskFolder(feature, id));
    const sidecarReport = readText(reportPath);
    if (sidecarReport !== null) {
      return sidecarReport;
    }

    const issue = await this.getBrIssue(this.resolveBrId(feature, id));
    if (!issue?.notes) return null;
    const legacyReport = this.decodeNotes(issue.notes).content || null;
    return legacyReport?.startsWith('# Task Report:') ? legacyReport : null;
  }

  async writeReport(feature: string, id: string, content: string): Promise<void> {
    const reportPath = getTaskReportPath(this.projectRoot, feature, this.resolveTaskFolder(feature, id));
    writeText(reportPath, content);
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
        const { stdout, stderr } = await execFileAsync('br', args, {
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
            [this.installHint()]
          );
        }

        // execFile rejects on non-zero exit -- extract exit code from error
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
    const workerSession = this.parseWorkerSession(decoded.metadata);
    return {
      folder,
      name: folder.replace(/^\d+-/, ''),
      status: this.toMaestroStatus(issue),
      origin: 'plan',
      planTitle: issue.title,
      summary: decoded.content || undefined,
      startedAt: decoded.metadata.startedAt,
      completedAt: decoded.metadata.completedAt,
      baseCommit: decoded.metadata.baseCommit,
      workerSession,
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

  private mergeMetadata(existing: Record<string, string>, fields: UpdateFields): Record<string, string> {
    const metadata = { ...existing };

    if (fields.baseCommit !== undefined) metadata.baseCommit = fields.baseCommit;
    if (fields.startedAt !== undefined) metadata.startedAt = fields.startedAt;
    if (fields.completedAt !== undefined) metadata.completedAt = fields.completedAt;

    if (fields.workerSession) {
      if (fields.workerSession.sessionId !== undefined) metadata.workerSessionId = fields.workerSession.sessionId;
      if (fields.workerSession.launcher !== undefined) metadata.workerLauncher = fields.workerSession.launcher;
      if (fields.workerSession.attempt !== undefined) metadata.workerAttempt = String(fields.workerSession.attempt);
      if (fields.workerSession.exitCode !== undefined) metadata.workerExitCode = String(fields.workerSession.exitCode);
      if (fields.workerSession.signal !== undefined) metadata.workerSignal = fields.workerSession.signal;
      if (fields.workerSession.lastHeartbeatAt !== undefined) metadata.workerHeartbeatAt = fields.workerSession.lastHeartbeatAt;
      if (fields.workerSession.workerPromptPath !== undefined) metadata.workerPromptPath = fields.workerSession.workerPromptPath;
    }

    return metadata;
  }

  private parseWorkerSession(metadata: Record<string, string>): WorkerSession | undefined {
    const hasWorkerMetadata = metadata.workerSessionId ||
      metadata.workerLauncher ||
      metadata.workerAttempt ||
      metadata.workerExitCode ||
      metadata.workerSignal ||
      metadata.workerHeartbeatAt ||
      metadata.workerPromptPath;

    if (!hasWorkerMetadata) {
      return undefined;
    }

    return {
      sessionId: metadata.workerSessionId || 'unknown-session',
      launcher: metadata.workerLauncher as WorkerSession['launcher'] | undefined,
      attempt: metadata.workerAttempt ? parseInt(metadata.workerAttempt, 10) : undefined,
      exitCode: metadata.workerExitCode ? parseInt(metadata.workerExitCode, 10) : undefined,
      signal: metadata.workerSignal,
      lastHeartbeatAt: metadata.workerHeartbeatAt,
      workerPromptPath: metadata.workerPromptPath,
    };
  }
}
