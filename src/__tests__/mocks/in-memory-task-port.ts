/**
 * InMemoryTaskPort -- mock TaskPort for unit testing use cases.
 * No br required.
 */

import type { TaskInfo, TaskStatusType, TaskOrigin } from '../../types.ts';
import type { TaskPort, CreateOpts, UpdateFields, ListOpts } from '../../ports/tasks.ts';
import { isValidTransition } from '../../ports/tasks.ts';
import { MaestroError } from '../../lib/errors.ts';

interface StoredTask extends TaskInfo {
  description?: string;
  notes?: string;
  dependsOnIds?: string[];
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

  async update(feature: string, id: string, fields: UpdateFields): Promise<TaskInfo> {
    const tasks = this.getFeatureTasks(feature);
    const task = tasks.get(id);
    if (!task) throw new MaestroError(`Task '${id}' not found`);

    if (fields.status) {
      if (!isValidTransition(task.status, fields.status)) {
        throw new MaestroError(
          `Invalid transition: ${task.status} -> ${fields.status}`
        );
      }
      task.status = fields.status;
    }

    if (fields.description !== undefined) task.description = fields.description;
    if (fields.notes !== undefined) task.notes = fields.notes;

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
      return tasks.filter(t => t.status !== 'cancelled' && t.status !== 'done').map(t => ({ ...t }));
    }

    return tasks.map(t => ({ ...t }));
  }

  async close(feature: string, id: string, reason?: string): Promise<{ suggestNext?: string[] }> {
    const tasks = this.getFeatureTasks(feature);
    const task = tasks.get(id);
    if (!task) throw new MaestroError(`Task '${id}' not found`);

    task.status = reason === 'cancelled' ? 'cancelled' : reason === 'failed' ? 'failed' : 'done';
    return { suggestNext: [] };
  }

  async addDependency(feature: string, taskId: string, dependsOnId: string): Promise<void> {
    const task = this.getFeatureTasks(feature).get(taskId);
    if (!task) throw new MaestroError(`Task '${taskId}' not found`);
    task.dependsOn = [...(task.dependsOn || []), dependsOnId];
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

  async getBlocked(feature: string): Promise<Record<string, string[]>> {
    const tasks = [...this.getFeatureTasks(feature).values()];
    const doneSet = new Set(tasks.filter(t => t.status === 'done').map(t => t.folder));
    const result: Record<string, string[]> = {};

    for (const task of tasks) {
      if (task.status !== 'pending') continue;
      const deps = task.dependsOn || [];
      const unmet = deps.filter(d => !doneSet.has(d));
      if (unmet.length > 0) {
        result[task.folder] = unmet;
      }
    }

    return result;
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

  async isAvailable(): Promise<boolean> {
    return true;
  }

  installHint(): string {
    return 'InMemoryTaskPort is always available';
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

  /** Seed a task with an exact folder name (bypass create()'s auto-generated folder) */
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
