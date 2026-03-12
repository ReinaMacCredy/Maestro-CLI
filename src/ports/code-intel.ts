/**
 * CodeIntelPort -- abstract interface for code intelligence.
 * Default implementation: tilth wrapper.
 */

export interface CodeIntelPort {
  query(q: string, opts?: { scope?: string; json?: boolean }): Promise<string>;
  map(scope: string): Promise<string>;
  isAvailable(): Promise<boolean>;
}
