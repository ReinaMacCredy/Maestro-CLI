/**
 * VerificationPort -- abstract interface for task verification.
 * Deterministic checks run against spec and acceptance criteria.
 */

export interface VerificationCriterion {
  name: string;
  passed: boolean;
  detail: string;
}

export interface VerificationReport {
  passed: boolean;
  score: number;           // 0.0-1.0 (passed_criteria / total_criteria)
  criteria: VerificationCriterion[];
  buildOutput?: string;    // truncated stderr on build failure
  suggestions: string[];
  timestamp: string;
}

export interface VerifyParams {
  projectRoot: string;
  featureName: string;
  taskFolder: string;
  summary: string;
  specContent?: string;
  acceptanceCriteria?: string;
  claimedAt?: string;
}

export interface VerificationPort {
  verify(params: VerifyParams): Promise<VerificationReport>;
}
