/**
 * FsTaskAdapter -- TaskPort implementation backed by plain JSON files.
 *
 * Storage layout:
 *   .maestro/features/<name>/tasks/
 *     01-setup-auth/
 *       status.json   -- task state (status, claimedBy, dependsOn, etc.)
 *       spec.md       -- compiled task spec
 *       report.md     -- task completion report
 */

import type { TaskInfo, TaskStatus } from '../types.ts';
import type { TaskPort, CreateOpts, ListOpts } from '../ports/tasks.ts';
import { MaestroError } from '../lib/errors.ts';
import {
  getTasksPath,
  getTaskPath,
  getTaskStatusPath,
  getTaskSpecPath,
  getTaskReportPath,
} from '../utils/paths.ts';
import { ensureDir, readJson, readText, writeText } from '../utils/fs-io.ts';
import { writeJsonAtomic } from '../utils/fs-io.ts';
import * as fs from 'fs';

export class FsTaskAdapter implements TaskPort {
  private projectRoot: string;
  private claimExpiresMinutes: number;

  constructor(projectRoot: string, claimExpiresMinutes = 120) {
    this.projectRoot = projectRoot;
    this.claimExpiresMinutes = claimExpiresMinutes;
  }

  async create(feature: string, title: string, opts?: CreateOpts): Promise<TaskInfo> {
    const tasksDir = getTasksPath(this.projectRoot, feature);
    ensureDir(tasksDir);

    const nextOrder = this.getNextOrder(feature);
    const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const folder = `${String(nextOrder).padStart(2, '0')}-${slug}`;

    const taskDir = getTaskPath(this.projectRoot, feature, folder);
    ensureDir(taskDir);

    const status: TaskStatus = {
      schemaVersion: 2,
      status: 'pending',
      origin: 'plan',
      planTitle: title,
      dependsOn: opts?.deps ?? [],
    };

    writeJsonAtomic(getTaskStatusPath(this.projectRoot, feature, folder), status);

    if (opts?.description) {
      writeText(getTaskSpecPath(this.projectRoot, feature, folder), opts.description);
    }

    return this.statusToInfo(folder, status);
  }

  async get(feature: string, id: string): Promise<TaskInfo | null> {
    const status = this.readStatus(feature, id);
    if (!status) return null;
    return this.statusToInfo(id, status);
  }

  async list(feature: string, opts?: ListOpts): Promise<TaskInfo[]> {
    const tasksDir = getTasksPath(this.projectRoot, feature);
    let folders: string[];
    try {
      folders = fs.readdirSync(tasksDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort();
    } catch {
      return [];
    }

    const tasks: TaskInfo[] = [];
    for (const folder of folders) {
      const status = this.readStatus(feature, folder);
      if (!status) continue;

      if (opts?.status && status.status !== opts.status) continue;
      if (!opts?.includeAll && status.status === 'done') continue;

      tasks.push(this.statusToInfo(folder, status));
    }

    return tasks;
  }

  async remove(feature: string, id: string): Promise<void> {
    const taskDir = getTaskPath(this.projectRoot, feature, id);
    try {
      fs.rmSync(taskDir, { recursive: true });
    } catch {
      // Already removed
    }
  }

  async claim(feature: string, id: string, agentId: string): Promise<TaskInfo> {
    const status = this.readStatus(feature, id);
    if (!status) throw new MaestroError(`Task '${id}' not found`);
    if (status.status !== 'pending') {
      throw new MaestroError(`Cannot claim task '${id}': status is '${status.status}', expected 'pending'`);
    }
    status.status = 'claimed';
    status.claimedBy = agentId;
    status.claimedAt = new Date().toISOString();
    this.writeStatus(feature, id, status);
    return this.statusToInfo(id, status);
  }

  async done(feature: string, id: string, summary: string): Promise<TaskInfo> {
    const status = this.readStatus(feature, id);
    if (!status) throw new MaestroError(`Task '${id}' not found`);
    if (status.status !== 'claimed') {
      throw new MaestroError(`Cannot complete task '${id}': status is '${status.status}', expected 'claimed'`);
    }
    status.status = 'done';
    status.summary = summary;
    status.completedAt = new Date().toISOString();
    status.claimedBy = undefined;
    status.claimedAt = undefined;
    this.writeStatus(feature, id, status);
    return this.statusToInfo(id, status);
  }

  async block(feature: string, id: string, reason: string): Promise<TaskInfo> {
    const status = this.readStatus(feature, id);
    if (!status) throw new MaestroError(`Task '${id}' not found`);
    if (status.status !== 'pending' && status.status !== 'claimed') {
      throw new MaestroError(`Cannot block task '${id}': status is '${status.status}'`);
    }
    status.status = 'blocked';
    status.blockerReason = reason;
    status.claimedBy = undefined;
    status.claimedAt = undefined;
    this.writeStatus(feature, id, status);
    return this.statusToInfo(id, status);
  }

  async unblock(feature: string, id: string, decision: string): Promise<TaskInfo> {
    const status = this.readStatus(feature, id);
    if (!status) throw new MaestroError(`Task '${id}' not found`);
    if (status.status !== 'blocked') {
      throw new MaestroError(`Cannot unblock task '${id}': status is '${status.status}', expected 'blocked'`);
    }
    status.status = 'pending';
    status.blockerDecision = decision;
    status.blockerReason = undefined;
    this.writeStatus(feature, id, status);
    return this.statusToInfo(id, status);
  }

  async getRunnable(feature: string): Promise<TaskInfo[]> {
    const all = await this.list(feature, { includeAll: true });
    const doneSet = new Set(all.filter(t => t.status === 'done').map(t => t.folder));
    const now = Date.now();
    const expiryMs = this.claimExpiresMinutes * 60 * 1000;

    // Auto-expire stale claims back to pending (write directly, no re-read)
    for (const t of all) {
      if (t.status === 'claimed' && t.claimedAt) {
        const claimedTime = new Date(t.claimedAt).getTime();
        if (now - claimedTime > expiryMs) {
          const expiredStatus: TaskStatus = {
            schemaVersion: 2,
            status: 'pending',
            origin: t.origin,
            planTitle: t.planTitle,
            dependsOn: t.dependsOn,
            summary: t.summary,
            completedAt: t.completedAt,
            blockerReason: t.blockerReason,
            blockerDecision: t.blockerDecision,
          };
          this.writeStatus(feature, t.folder, expiredStatus);
          t.status = 'pending';
          t.claimedBy = undefined;
          t.claimedAt = undefined;
        }
      }
    }

    return all.filter(t => {
      if (t.status !== 'pending') return false;
      const deps = t.dependsOn || [];
      return deps.every(d => doneSet.has(d));
    });
  }

  async readSpec(feature: string, id: string): Promise<string | null> {
    return readText(getTaskSpecPath(this.projectRoot, feature, id));
  }

  async writeSpec(feature: string, id: string, content: string): Promise<void> {
    const taskDir = getTaskPath(this.projectRoot, feature, id);
    ensureDir(taskDir);
    writeText(getTaskSpecPath(this.projectRoot, feature, id), content);
  }

  async readReport(feature: string, id: string): Promise<string | null> {
    return readText(getTaskReportPath(this.projectRoot, feature, id));
  }

  async writeReport(feature: string, id: string, content: string): Promise<void> {
    const taskDir = getTaskPath(this.projectRoot, feature, id);
    ensureDir(taskDir);
    writeText(getTaskReportPath(this.projectRoot, feature, id), content);
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private readStatus(feature: string, folder: string): TaskStatus | null {
    return readJson<TaskStatus>(getTaskStatusPath(this.projectRoot, feature, folder));
  }

  private writeStatus(feature: string, folder: string, status: TaskStatus): void {
    writeJsonAtomic(getTaskStatusPath(this.projectRoot, feature, folder), status);
  }

  private statusToInfo(folder: string, status: TaskStatus): TaskInfo {
    return {
      folder,
      name: folder.replace(/^\d+-/, ''),
      status: status.status,
      origin: status.origin,
      planTitle: status.planTitle,
      summary: status.summary,
      claimedBy: status.claimedBy,
      claimedAt: status.claimedAt,
      completedAt: status.completedAt,
      blockerReason: status.blockerReason,
      blockerDecision: status.blockerDecision,
      dependsOn: status.dependsOn,
    };
  }

  private getNextOrder(feature: string): number {
    const tasksDir = getTasksPath(this.projectRoot, feature);
    try {
      const folders = fs.readdirSync(tasksDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);
      const orders = folders.map(f => {
        const match = f.match(/^(\d+)-/);
        return match ? parseInt(match[1], 10) : 0;
      });
      return orders.length > 0 ? Math.max(...orders) + 1 : 1;
    } catch {
      return 1;
    }
  }
}
