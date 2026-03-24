/**
 * FsSearchAdapter -- filesystem-based SearchPort fallback.
 * Scans .maestro/sessions/events.jsonl for keyword matches when CASS is unavailable.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getSessionsDir, EVENTS_FILE } from '../hooks/_helpers.ts';
import type { SearchPort, SessionSearchResult } from './port.ts';

export class FsSearchAdapter implements SearchPort {
  private eventsPath: string;

  constructor(private projectRoot: string) {
    this.eventsPath = path.join(getSessionsDir(projectRoot), EVENTS_FILE);
  }

  async searchSessions(query: string, opts?: {
    agent?: string;
    limit?: number;
    days?: number;
  }): Promise<SessionSearchResult[]> {
    const lines = this.readLines();
    const queryLower = query.toLowerCase();
    const limit = opts?.limit ?? 20;
    const cutoff = opts?.days ? Date.now() - opts.days * 86_400_000 : undefined;

    const results: SessionSearchResult[] = [];
    for (let i = 0; i < lines.length && results.length < limit; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      if (cutoff) {
        try {
          const entry = JSON.parse(line) as { timestamp?: string };
          if (entry.timestamp && new Date(entry.timestamp).getTime() < cutoff) continue;
        } catch {
          // Non-JSON lines: include by default
        }
      }

      if (!line.toLowerCase().includes(queryLower)) continue;
      if (opts?.agent) {
        const agentName = this.extractAgent(line);
        if (agentName !== opts.agent) continue;
      }

      results.push(this.lineToResult(line, i + 1));
    }

    return results;
  }

  async findRelatedSessions(filePath: string, limit = 5): Promise<SessionSearchResult[]> {
    return this.searchSessions(filePath, { limit });
  }

  private readLines(): string[] {
    if (!fs.existsSync(this.eventsPath)) return [];
    try {
      return fs.readFileSync(this.eventsPath, 'utf-8').split('\n');
    } catch {
      return [];
    }
  }

  private extractAgent(line: string): string {
    try {
      const entry = JSON.parse(line) as { agent?: string };
      return entry.agent ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private lineToResult(line: string, lineNumber: number): SessionSearchResult {
    return {
      sessionPath: this.eventsPath,
      agent: this.extractAgent(line),
      matchLine: line.slice(0, 200),
      lineNumber,
      score: 1,
    };
  }
}
