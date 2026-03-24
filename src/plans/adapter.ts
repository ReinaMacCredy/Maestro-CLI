/**
 * Filesystem-based plan adapter for maestroCLI.
 * Forked from hive-core/src/services/planService.ts -- direct copy.
 */

import {
  getPlanPath,
  getCommentsPath,
  getApprovedPath,
} from '../core/paths.ts';
import { readJson, writeJsonAtomic, readText, writeText, fileExists } from '../core/fs-io.ts';
import type { CommentsJson, PlanComment, PlanReadResult } from '../core/types.ts';
import type { PlanPort } from './port.ts';
import * as fs from 'fs';

export class FsPlanAdapter implements PlanPort {
  constructor(private projectRoot: string) {}

  write(featureName: string, content: string): string {
    const planPath = getPlanPath(this.projectRoot, featureName);
    writeText(planPath, content);

    this.clearComments(featureName);
    this.revokeApproval(featureName);

    return planPath;
  }

  read(featureName: string): PlanReadResult | null {
    const planPath = getPlanPath(this.projectRoot, featureName);
    const content = readText(planPath);

    if (content === null) return null;

    const comments = this.getComments(featureName);
    const isApproved = this.isApproved(featureName);

    return {
      content,
      status: isApproved ? 'approved' : 'planning',
      comments,
    };
  }

  approve(featureName: string): void {
    const planContent = readText(getPlanPath(this.projectRoot, featureName));
    if (planContent === null) {
      throw new Error(`No plan.md found for feature '${featureName}'`);
    }

    const approvedPath = getApprovedPath(this.projectRoot, featureName);
    const timestamp = new Date().toISOString();
    writeText(approvedPath, `Approved at ${timestamp}\n`);
  }

  isApproved(featureName: string): boolean {
    return fileExists(getApprovedPath(this.projectRoot, featureName));
  }

  revokeApproval(featureName: string): void {
    const approvedPath = getApprovedPath(this.projectRoot, featureName);
    try {
      fs.unlinkSync(approvedPath);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }

  getComments(featureName: string): PlanComment[] {
    const commentsPath = getCommentsPath(this.projectRoot, featureName);
    const data = readJson<CommentsJson>(commentsPath);
    return data?.threads || [];
  }

  addComment(featureName: string, comment: Omit<PlanComment, 'id' | 'timestamp'>): PlanComment {
    const commentsPath = getCommentsPath(this.projectRoot, featureName);
    const data = readJson<CommentsJson>(commentsPath) || { threads: [] };

    const newComment: PlanComment = {
      ...comment,
      id: `comment-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    data.threads.push(newComment);
    writeJsonAtomic(commentsPath, data);

    return newComment;
  }

  clearComments(featureName: string): void {
    const commentsPath = getCommentsPath(this.projectRoot, featureName);
    writeJsonAtomic(commentsPath, { threads: [] });
  }
}
