/**
 * InMemoryTaskPort -- mock TaskPort for unit testing.
 * Updated for 6-state model (pending/claimed/done/blocked/review/revision).
 */

import type { TaskInfo, TaskStatusType, TaskOrigin } from '../../types.ts';
import type { TaskPort, CreateOpts, ListOpts } from '../../ports/tasks.ts';
import { isDependencySatisfied } from '../../ports/tasks.ts';
import type { VerificationReport } from '../../ports/verification.ts';
import { MaestroError } from '../../core/errors.ts';
import { buildTaskFolder } from '../../core/slug.ts';

interface StoredTask extends TaskInfo {
  description?: string;
}

export class InMemoryTaskPort implements TaskPort {
  private tasks = new Map<string, Map<string, StoredTask>>();
  private specs = new Map<string, string>();
  private reports = new Map<string, string>();
  private verifications = new Map<string, VerificationReport>();
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
    const folder = buildTaskFolder(id, title);

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
    if (task.status !== 'pending' && task.status !== 'revision') {
      throw new MaestroError(`Cannot claim: status is '${task.status}'`);
    }
    // Preserve revision metadata when re-claiming
    task.status = 'claimed';
    task.claimedBy = agentId;
    task.claimedAt = new Date().toISOString();
    return { ...task };
  }

  async done(feature: string, id: string, summary: string): Promise<TaskInfo> {
    const task = this.getFeatureTasks(feature).get(id);
    if (!task) throw new MaestroError(`Task '${id}' not found`);
    if (task.status !== 'claimed' && task.status !== 'review') {
      throw new MaestroError(`Cannot complete: status is '${task.status}'`);
    }
    task.status = 'done';
    task.summary = summary;
    task.completedAt = new Date().toISOString();
    return { ...task };
  }

  async review(feature: string, id: string, summary: string): Promise<TaskInfo> {
    const task = this.getFeatureTasks(feature).get(id);
    if (!task) throw new MaestroError(`Task '${id}' not found`);
    if (task.status !== 'claimed') throw new MaestroError(`Cannot review: status is '${task.status}'`);
    task.status = 'review';
    task.summary = summary;
    return { ...task };
  }

  async revision(feature: string, id: string, feedback: string, revisionCount: number): Promise<TaskInfo> {
    const task = this.getFeatureTasks(feature).get(id);
    if (!task) throw new MaestroError(`Task '${id}' not found`);
    if (task.status !== 'review') throw new MaestroError(`Cannot revise: status is '${task.status}'`);
    task.status = 'revision';
    task.revisionFeedback = feedback;
    task.revisionCount = revisionCount;
    task.claimedBy = undefined;
    task.claimedAt = undefined;
    return { ...task };
  }

  async readVerification(feature: string, id: string): Promise<VerificationReport | null> {
    return this.verifications.get(this.specKey(feature, id)) ?? null;
  }

  async writeVerification(feature: string, id: string, report: VerificationReport): Promise<void> {
    this.verifications.set(this.specKey(feature, id), report);
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
    const satisfiedSet = new Set(
      tasks.filter(t => isDependencySatisfied(t.status)).map(t => t.folder),
    );

    return tasks.filter(t => {
      if (t.status !== 'pending' && t.status !== 'revision') return false;
      const deps = t.dependsOn || [];
      return deps.every(d => satisfiedSet.has(d));
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
    this.verifications.clear();
    this.nextId = 1;
  }

  /** Directly set task status (bypass state machine for test setup) */
  setStatus(feature: string, folder: string, status: TaskStatusType): void {
    const task = this.getFeatureTasks(feature).get(folder);
    if (task) task.status = status;
  }

  /** Seed a task with an exact folder name */
  seed(feature: string, folder: string, overrides: Partial<TaskInfo> & { status?: TaskStatusType; origin?: TaskOrigin; dependsOn?: string[] } = {}): void {
    const map = this.getFeatureTasks(feature);
    map.set(folder, {
      folder,
      name: overrides.name ?? folder,
      status: overrides.status ?? 'pending',
      origin: overrides.origin ?? 'plan',
      planTitle: overrides.planTitle ?? folder,
      dependsOn: overrides.dependsOn ?? [],
      summary: overrides.summary,
      revisionCount: overrides.revisionCount,
      revisionFeedback: overrides.revisionFeedback,
      completedAt: overrides.completedAt,
    });
  }
}
