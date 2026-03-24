/**
 * CassSearchAdapter -- SearchPort implementation backed by CASS CLI.
 *
 * CASS indexes conversations from Claude Code, Codex, Cursor, Gemini, etc.
 * Always uses --robot/--json flags (never bare cass which launches TUI).
 */

import type { SearchPort, SessionSearchResult } from '../../../../search/port.ts';
import { CliTransport } from '../../../sdk/cli-transport.ts';
import type { AdapterContext, AdapterFactory } from '../../../types.ts';

interface CassSearchHit {
  source_path?: string;
  agent?: string;
  snippet?: string;
  content?: string;
  line_number?: number;
  score?: number;
  title?: string;
}

export class CassSearchAdapter implements SearchPort {
  private cli: CliTransport;

  constructor() {
    this.cli = new CliTransport({
      binary: 'cass',
      cwd: process.cwd(),
      toolName: 'cass',
      installHint: 'cass (Coding Agent Session Search) is required. Install: https://github.com/Dicklesworthstone/coding_agent_session_search',
    });
  }

  async searchSessions(query: string, opts?: {
    agent?: string;
    limit?: number;
    days?: number;
  }): Promise<SessionSearchResult[]> {
    const args = ['search', query, '--robot'];
    if (opts?.limit) args.push('--limit', String(opts.limit));
    if (opts?.agent) args.push('--agent', opts.agent);
    if (opts?.days) args.push('--days', String(opts.days));
    args.push('--fields', 'minimal');

    const raw = await this.cli.exec<CassSearchHit[] | { hits?: CassSearchHit[]; results?: CassSearchHit[] }>(args);
    const hits = Array.isArray(raw) ? raw : (raw.hits ?? raw.results ?? []);
    return hits.map(normalizeHit);
  }

  async findRelatedSessions(filePath: string, limit = 5): Promise<SessionSearchResult[]> {
    return this.searchSessions(filePath, { limit });
  }

  async searchSimilar(content: string, opts?: { limit?: number }): Promise<SessionSearchResult[]> {
    // Extract first 100 chars as query -- CASS handles keyword matching natively
    const query = content.slice(0, 100).replace(/\n/g, ' ').trim();
    if (!query) return [];
    return this.searchSessions(query, { limit: opts?.limit ?? 10 });
  }
}

function normalizeHit(hit: CassSearchHit): SessionSearchResult {
  return {
    sessionPath: hit.source_path ?? '',
    agent: hit.agent ?? 'unknown',
    matchLine: hit.snippet ?? hit.title ?? '',
    lineNumber: hit.line_number ?? 0,
    score: hit.score ?? 0,
  };
}

export const createAdapter: AdapterFactory<SearchPort> = (_ctx: AdapterContext) => {
  return new CassSearchAdapter();
};
