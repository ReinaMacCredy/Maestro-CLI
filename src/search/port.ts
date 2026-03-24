/**
 * SearchPort -- session history search interface.
 * Backed by CASS (Coding Agent Session Search).
 */

export interface SessionSearchResult {
  sessionPath: string;
  agent: string;
  matchLine: string;
  lineNumber: number;
  score: number;
}

export interface SearchPort {
  /** Search past agent sessions for context. */
  searchSessions(query: string, opts?: {
    agent?: string;
    limit?: number;
    days?: number;
  }): Promise<SessionSearchResult[]>;

  /** Find sessions related to a specific file path. */
  findRelatedSessions(filePath: string, limit?: number): Promise<SessionSearchResult[]>;

  /** Find sessions with content similar to the provided text (keyword overlap). */
  searchSimilar(content: string, opts?: { limit?: number }): Promise<SessionSearchResult[]>;
}
