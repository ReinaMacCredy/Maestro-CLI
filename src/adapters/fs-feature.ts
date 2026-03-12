/**
 * Filesystem-based feature adapter for maestroCLI.
 * Forked from hive-core/src/services/featureService.ts.
 * Adapted: stripped getTasks() -- task listing goes through TaskPort.
 */

import * as fs from 'fs';
import {
  getFeaturePath,
  getFeaturesPath,
  getFeatureJsonPath,
  getContextPath,
  getTasksPath,
  getPlanPath,
  getCommentsPath,
  ensureDir,
  readJson,
  writeJson,
  fileExists,
} from '../utils/paths.ts';
import type { FeatureJson, FeatureStatusType, CommentsJson } from '../types.ts';

export class FsFeatureAdapter {
  constructor(private projectRoot: string) {}

  create(name: string, ticket?: string): FeatureJson {
    const featurePath = getFeaturePath(this.projectRoot, name);

    if (fileExists(featurePath)) {
      throw new Error(`Feature '${name}' already exists`);
    }

    ensureDir(featurePath);
    ensureDir(getContextPath(this.projectRoot, name));
    ensureDir(getTasksPath(this.projectRoot, name));

    const feature: FeatureJson = {
      name,
      status: 'planning',
      ticket,
      createdAt: new Date().toISOString(),
    };

    writeJson(getFeatureJsonPath(this.projectRoot, name), feature);

    return feature;
  }

  get(name: string): FeatureJson | null {
    return readJson<FeatureJson>(getFeatureJsonPath(this.projectRoot, name));
  }

  list(): string[] {
    const featuresPath = getFeaturesPath(this.projectRoot);
    if (!fileExists(featuresPath)) return [];

    return fs.readdirSync(featuresPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  }

  getActive(): FeatureJson | null {
    const features = this.list();
    for (const name of features) {
      const feature = this.get(name);
      if (feature && feature.status !== 'completed') {
        return feature;
      }
    }
    return null;
  }

  updateStatus(name: string, status: FeatureStatusType): FeatureJson {
    const feature = this.get(name);
    if (!feature) throw new Error(`Feature '${name}' not found`);

    feature.status = status;

    if (status === 'approved' && !feature.approvedAt) {
      feature.approvedAt = new Date().toISOString();
    }
    if (status === 'completed' && !feature.completedAt) {
      feature.completedAt = new Date().toISOString();
    }

    writeJson(getFeatureJsonPath(this.projectRoot, name), feature);
    return feature;
  }

  /**
   * Get feature info without task list.
   * Task listing is now the responsibility of TaskPort.
   */
  getInfo(name: string): { name: string; status: FeatureStatusType; hasPlan: boolean; commentCount: number } | null {
    const feature = this.get(name);
    if (!feature) return null;

    const hasPlan = fileExists(getPlanPath(this.projectRoot, name));
    const comments = readJson<CommentsJson>(getCommentsPath(this.projectRoot, name));
    const commentCount = comments?.threads?.length || 0;

    return {
      name: feature.name,
      status: feature.status,
      hasPlan,
      commentCount,
    };
  }

  complete(name: string): FeatureJson {
    const feature = this.get(name);
    if (!feature) throw new Error(`Feature '${name}' not found`);

    if (feature.status === 'completed') {
      throw new Error(`Feature '${name}' is already completed`);
    }

    return this.updateStatus(name, 'completed');
  }

  setSession(name: string, sessionId: string): void {
    const feature = this.get(name);
    if (!feature) throw new Error(`Feature '${name}' not found`);

    feature.sessionId = sessionId;
    writeJson(getFeatureJsonPath(this.projectRoot, name), feature);
  }

  getSession(name: string): string | undefined {
    const feature = this.get(name);
    return feature?.sessionId;
  }
}
