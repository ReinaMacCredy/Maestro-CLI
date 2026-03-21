/**
 * Parse structured fields from execution memory body.
 * Shared utility -- used by execution-insights and query-historical-context.
 */

import { parseFrontmatterRich, stripFrontmatter } from './frontmatter.ts';

export interface ParsedExecMemory {
  summary: string;
  filesChanged: number;
  verificationPassed: boolean;
  tags: string[];
  revisionCount: number;
  duration: string | undefined;
}

export function parseExecMemory(content: string): ParsedExecMemory {
  const meta = parseFrontmatterRich(content);
  const body = stripFrontmatter(content);

  const summaryMatch = body.match(/\*\*Summary\*\*:\s*(.+)/);
  const summary = summaryMatch?.[1] ?? '';

  const filesMatch = body.match(/\*\*Files changed\*\*\s*\((\d+)\)/);
  const filesChanged = filesMatch ? parseInt(filesMatch[1], 10) : 0;

  const verificationPassed = body.includes('**Verification**: passed');

  const rawTags = meta?.tags;
  const tags = Array.isArray(rawTags) ? rawTags as string[] : [];

  const revisionMatch = body.match(/\*\*Revisions\*\*:\s*(\d+)/);
  const revisionCount = revisionMatch ? parseInt(revisionMatch[1], 10) : 0;

  const durationMatch = body.match(/\*\*Duration\*\*:\s*(.+)/);
  const duration = durationMatch?.[1]?.trim();

  return { summary, filesChanged, verificationPassed, tags, revisionCount, duration: duration === 'unknown' ? undefined : duration };
}
