/**
 * FeaturePort -- abstract interface for feature storage.
 * Concrete implementation: FsFeatureAdapter.
 */

import type { FeatureJson, FeatureStatusType } from '../types.ts';

export interface FeaturePort {
  create(name: string, ticket?: string): FeatureJson;
  get(name: string): FeatureJson | null;
  list(): string[];
  requireActive(name: string): FeatureJson;
  getActive(): FeatureJson | null;
  updateStatus(name: string, status: FeatureStatusType): FeatureJson;
  getInfo(name: string): { name: string; status: FeatureStatusType; hasPlan: boolean; commentCount: number } | null;
  complete(name: string): FeatureJson;
  setSession(name: string, sessionId: string): void;
  getSession(name: string): string | undefined;
}
