/**
 * SearchPort -- abstract interface for code search.
 * Default implementation: ripgrep wrapper.
 */

export interface SearchResult {
  file: string;
  line: number;
  content: string;
}

export interface SearchPort {
  search(pattern: string, opts?: { path?: string; type?: string; maxResults?: number }): Promise<SearchResult[]>;
  isAvailable(): Promise<boolean>;
}
