/**
 * SessionPort -- abstract interface for session storage.
 * Concrete implementation: FsSessionAdapter.
 */

import type { SessionInfo, SessionsJson } from '../types.ts';

export interface SessionPort {
  getAll(featureName: string): SessionsJson;
  track(featureName: string, sessionId: string, taskFolder?: string): SessionInfo;
  setMaster(featureName: string, sessionId: string): void;
  getMaster(featureName: string): string | undefined;
  list(featureName: string): SessionInfo[];
  get(featureName: string, sessionId: string): SessionInfo | undefined;
  getByTask(featureName: string, taskFolder: string): SessionInfo | undefined;
  remove(featureName: string, sessionId: string): boolean;
  findFeatureBySession(sessionId: string): string | null;
  fork(featureName: string, fromSessionId?: string): SessionInfo;
  fresh(featureName: string, title?: string): SessionInfo;
}
