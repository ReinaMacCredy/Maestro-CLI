/**
 * InMemoryTaskPort -- mock TaskPort for unit testing.
 * Updated for 4-state model (pending/claimed/done/blocked).
 */

import type { TaskInfo, TaskStatusType, TaskOrigin } from '../../types.ts';
import type { TaskPort, CreateOpts, ListOpts } from '../../ports/tasks.ts';
import { MaestroError } from '../../lib/errors.ts';

interface StoredTask extends TaskInfo {
  description?: string;
}

export class InMemoryTaskPort implements TaskPort {
  private tasks = new Map<string, Map<string, StoredTask>>();
  private specs = new Map<string, string>();
  private reports = new Map<string, string>();
  private nextId = 1;

  private getFeatureTasks(feature: string): Map<string, StoredTask> {
    if (!this.tasks.has(feature)) {
      this.tasks.set(feature, new Map());
    }
    return this.tasks.get(feature)!;
  }

  private specKey(feature: string, id: string): string {
    return `${feature}::${id}`;
  }

  async create(feature: string, title: string, opts?: CreateOpts): Promise<TaskInfo> {
    const id = String(this.nextId++);
    const folder = `${id.padStart(2, '0')}-${title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;

    const task: StoredTask = {
      folder,
      name: title,
      status: 'pending',
      origin: 'plan',
      planTitle: title,
      dependsOn: opts?.deps,
    };

    this.getFeatureTasks(feature).set(folder, task);
    return { ...task };
  }

  async get(feature: string, id: string): Promise<TaskInfo | null> {
    const task = this.getFeatureTasks(feature).get(id);
    return task ? { ...task } : null;
  }

  async list(feature: string, opts?: ListOpts): Promise<TaskInfo[]> {
    const tasks = [...this.getFeatureTasks(feature).values()];

    if (opts?.status) {
      return tasks.filter(t => t.status === opts.status).map(t => ({ ...t }));
    }

    if (!opts?.includeAll) {
      return tasks.filter(t => t.status !== 'done').map(t => ({ ...t }));
    }

    return tasks.map(t => ({ ...t }));
  }

  async remove(feature: string, id: string): Promise<void> {
    const tasks = this.getFeatureTasks(feature);
    if (!tasks.has(id)) throw new MaestroError(`Task '${id}' not found`);
    tasks.delete(id);
  }

  async claim(feature: string, id: string, agentId: string): Promise<TaskInfo> {
    const task = this.getFeatureTasks(feature).get(id);
    if (!task) throw new MaestroError(`Task '${id}' not found`);
    if (task.status !== 'pending') throw new MaestroError(`Cannot claim: status is '${task.status}'`);
    task.status = 'claimed';
    task.claimedBy = agentId;
    task.claimedAt = new Date().toISOString();
    return { ...task };
  }

  async done(feature: string, id: string, summary: string): Promise<TaskInfo> {
    const task = this.getFeatureTasks(feature).get(id);
    if (!task) throw new MaestroError(`Task '${id}' not found`);
    if (task.status !== 'claimed') throw new MaestroError(`Cannot complete: status is '${task.status}'`);
    task.status = 'done';
    task.summary = summary;
    task.completedAt = new Date().toISOString();
    return { ...task };
  }

  async block(feature: string, id: string, reason: string): Promise<TaskInfo> {
    const task = this.getFeatureTasks(feature).get(id);
    if (!task) throw new MaestroError(`Task '${id}' not found`);
    task.status = 'blocked';
    task.blockerReason = reason;
    return { ...task };
  }

  async unblock(feature: string, id: string, decision: string): Promise<TaskInfo> {
    const task = this.getFeatureTasks(feature).get(id);
    if (!task) throw new MaestroError(`Task '${id}' not found`);
    if (task.status !== 'blocked') throw new MaestroError(`Cannot unblock: status is '${task.status}'`);
    task.status = 'pending';
    task.blockerDecision = decision;
    return { ...task };
  }

  async getRunnable(feature: string): Promise<TaskInfo[]> {
    const tasks = [...this.getFeatureTasks(feature).values()];
    const doneSet = new Set(tasks.filter(t => t.status === 'done').map(t => t.folder));

    return tasks.filter(t => {
      if (t.status !== 'pending') return false;
      const deps = t.dependsOn || [];
      return deps.every(d => doneSet.has(d));
    }).map(t => ({ ...t }));
  }

  async readSpec(feature: string, id: string): Promise<string | null> {
    return this.specs.get(this.specKey(feature, id)) || null;
  }

  async writeSpec(feature: string, id: string, content: string): Promise<void> {
    this.specs.set(this.specKey(feature, id), content);
  }

  async readReport(feature: string, id: string): Promise<string | null> {
    return this.reports.get(this.specKey(feature, id)) || null;
  }

  async writeReport(feature: string, id: string, content: string): Promise<void> {
    this.reports.set(this.specKey(feature, id), content);
  }

  // Test helpers
  reset(): void {
    this.tasks.clear();
    this.specs.clear();
    this.reports.clear();
    this.nextId = 1;
  }

  /** Directly set task status (bypass state machine for test setup) */
  setStatus(feature: string, folder: string, status: TaskStatusType): void {
    const task = this.getFeatureTasks(feature).get(folder);
    if (task) task.status = status;
  }

  /** Seed a task with an exact folder name */
  seed(feature: string, folder: string, overrides: { status?: TaskStatusType; origin?: TaskOrigin; dependsOn?: string[] } = {}): void {
    const map = this.getFeatureTasks(feature);
    map.set(folder, {
      folder,
      name: folder,
      status: overrides.status ?? 'pending',
      origin: overrides.origin ?? 'plan',
      planTitle: folder,
      dependsOn: overrides.dependsOn ?? [],
    });
  }
}
