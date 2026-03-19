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
import type { TaskPort, CreateOpts, ListOpts, RichTaskFields } from '../ports/tasks.ts';
import { MaestroError } from '../lib/errors.ts';
import { getFeaturePath, getTaskReportPath } from '../utils/paths.ts';
import { readJson, writeJson, ensureDir, readText, writeText } from '../utils/fs-io.ts';
import { CliRunner } from '../utils/cli-runner.ts';
import * as path from 'path';

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
  design?: string;
  acceptance_criteria?: string;
  notes?: string;
  close_reason?: string;
  dependencies?: number[];
  dependents?: number[];
  issue_type?: string;
  priority?: number;
  estimated_minutes?: number;
  assignee?: string;
  comments?: BrComment[];
}

interface BrComment {
  body: string;
  author?: string;
  created_at?: string;
}

interface BrMapping {
  /** folder name -> br issue ID */
  folderToId: Record<string, number | string>;
  /** br issue ID -> folder name */
  idToFolder: Record<string, string>;
}

export class BrTaskAdapter implements TaskPort {
  private projectRoot: string;
  private cli: CliRunner;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.cli = new CliRunner('br', {
      cwd: projectRoot,
      toolName: 'br',
      retryExitCodes: [5],
      installHint: 'br (beads_rust) is required. Install: cargo install beads_rust',
    });
  }

  // --------------------------------------------------------------------------
  // TaskPort implementation
  // --------------------------------------------------------------------------

  async create(feature: string, title: string, opts?: CreateOpts): Promise<TaskInfo> {
    const args = ['create', '--title', title];
    // Add feature label unless opts.labels already includes it
    const hasFeatureLabel = opts?.labels?.some(l => l === `feature:${feature}`);
    if (!hasFeatureLabel) {
      args.push('-l', `feature:${feature}`);
    }
    if (opts?.deps) {
      for (const dep of opts.deps) {
        const depId = this.resolveBrId(feature, dep);
        args.push('--deps', `blocks:${depId}`);
      }
    }
    if (opts?.description) args.push('--description', opts.description);
    if (opts?.type) args.push('-t', opts.type);
    if (opts?.priority != null) args.push('-p', String(opts.priority));
    if (opts?.estimate != null) args.push('-e', String(opts.estimate));
    if (opts?.labels) {
      for (const label of opts.labels) {
        args.push('-l', label);
      }
    }
    args.push('--json');

    const raw = await this.exec<BrIssue | BrIssue[]>(args);
    const issue = Array.isArray(raw) ? raw[0] : raw;
    const folder = this.titleToFolder(title, issue.id);

    this.saveMappingEntry(feature, folder, issue.id);

    // br create doesn't support --design/--acceptance; set them via update
    if (opts?.design || opts?.acceptanceCriteria || opts?.notes) {
      const updateArgs = ['update', String(issue.id)];
      if (opts.design) updateArgs.push('--design', opts.design);
      if (opts.acceptanceCriteria) updateArgs.push('--acceptance', opts.acceptanceCriteria);
      if (opts.notes) updateArgs.push('--notes', opts.notes);
      await this.exec(updateArgs);
    }

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
    // --claim is atomic: sets assignee=actor + status=in_progress
    await this.exec(['update', String(brId), '--claim', '--actor', agentId]);
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
  // Rich bead methods (optional TaskPort extensions)
  // --------------------------------------------------------------------------

  async getRichFields(feature: string, id: string): Promise<RichTaskFields | null> {
    const brId = this.resolveBrId(feature, id);
    const issue = await this.getBrIssue(brId);
    if (!issue) return null;

    return {
      description: issue.description ?? undefined,
      design: issue.design ?? undefined,
      acceptanceCriteria: issue.acceptance_criteria ?? undefined,
      notes: issue.notes ?? undefined,
      type: issue.issue_type ?? undefined,
      priority: issue.priority ?? undefined,
      estimate: issue.estimated_minutes ?? undefined,
      labels: issue.labels,
      assignee: issue.assignee ?? undefined,
      comments: issue.comments?.map(c => ({
        body: c.body,
        author: c.author ?? 'unknown',
        timestamp: c.created_at ?? '',
      })),
    };
  }

  async updateRichFields(feature: string, id: string, fields: Partial<RichTaskFields>): Promise<void> {
    const brId = this.resolveBrId(feature, id);
    const args = ['update', String(brId)];

    if (fields.description != null) args.push('--description', fields.description);
    if (fields.design != null) args.push('--design', fields.design);
    if (fields.acceptanceCriteria != null) args.push('--acceptance', fields.acceptanceCriteria);
    if (fields.notes != null) args.push('--notes', fields.notes);
    if (fields.type != null) args.push('-t', fields.type);
    if (fields.priority != null) args.push('-p', String(fields.priority));
    if (fields.estimate != null) args.push('-e', String(fields.estimate));
    if (fields.assignee != null) args.push('--assignee', fields.assignee);

    if (args.length > 2) {
      await this.exec(args);
    }
  }

  async suggestNext(feature: string, id: string): Promise<TaskInfo[]> {
    const brId = this.resolveBrId(feature, id);
    try {
      const result = await this.exec<BrIssue[]>(
        ['close', String(brId), '--suggest-next', '--json']
      );
      return this.mapIssuesToTasks(feature, Array.isArray(result) ? result : []);
    } catch {
      return [];
    }
  }

  async addComment(feature: string, id: string, body: string): Promise<void> {
    const brId = this.resolveBrId(feature, id);
    await this.exec(['comments', 'add', String(brId), '--message', body]);
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private exec<T = unknown>(args: string[]): Promise<T> {
    return this.cli.exec<T>(args);
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
