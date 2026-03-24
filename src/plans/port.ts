/**
 * PlanPort -- abstract interface for plan storage.
 * Concrete implementation: FsPlanAdapter.
 */

import type { PlanComment, PlanReadResult } from '../core/types.ts';

export interface PlanPort {
  write(featureName: string, content: string): string;
  read(featureName: string): PlanReadResult | null;
  approve(featureName: string): void;
  isApproved(featureName: string): boolean;
  revokeApproval(featureName: string): void;
  getComments(featureName: string): PlanComment[];
  addComment(featureName: string, comment: Omit<PlanComment, 'id' | 'timestamp'>): PlanComment;
  clearComments(featureName: string): void;
}
