/**
 * FsHandoffAdapter -- filesystem-only HandoffPort implementation.
 * Built-in fallback when Agent Mail is not available.
 * Writes/reads handoff documents under .maestro/features/<feature>/handoffs/.
 */

import type { HandoffPort, HandoffDocument, HandoffResult } from './port.ts';
import type { TaskPort } from '../tasks/port.ts';
import type { MemoryPort } from '../memory/port.ts';
import { getHandoffPath, getHandoffsPath } from '../core/paths.ts';
import { ensureDir, writeText, readText, fileExists } from '../core/fs-io.ts';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export class FsHandoffAdapter implements HandoffPort {
  constructor(
    private readonly projectRoot: string,
    private readonly taskPort: TaskPort,
    private readonly memoryAdapter: MemoryPort,
  ) {}

  async buildHandoff(feature: string, taskId: string): Promise<HandoffDocument> {
    const task = await this.taskPort.get(feature, taskId);

    const memories = this.memoryAdapter.list(feature);
    const decisions = memories.map(mf => ({
      key: mf.name,
      value: mf.content.slice(0, 500),
    }));

    const modifiedFiles = this.getModifiedFiles();

    return {
      beadId: taskId,
      beadState: {
        title: task?.planTitle ?? task?.name ?? taskId,
        status: task?.status ?? 'unknown',
      },
      decisions,
      modifiedFiles,
      blockers: task?.status === 'blocked' ? [task.summary ?? 'Unknown blocker'] : [],
      openQuestions: [],
      nextSteps: [],
      criticalContext: '',
      cassPointer: `Search prior sessions: maestro search-sessions --query "${task?.name ?? taskId}"`,
    };
  }

  async sendHandoff(
    feature: string,
    handoff: HandoffDocument,
    _targetAgent?: string,
  ): Promise<HandoffResult> {
    const body = this.formatHandoff(handoff, feature);
    const filePath = getHandoffPath(this.projectRoot, feature, handoff.beadId);
    ensureDir(path.dirname(filePath));
    writeText(filePath, body);
    return { filePath, agentMailSent: false };
  }

  async receiveHandoffs(feature: string | undefined, _agentId?: string): Promise<HandoffDocument[]> {
    if (!feature) return [];

    const handoffsDir = getHandoffsPath(this.projectRoot, feature);
    const handoffs: HandoffDocument[] = [];

    try {
      const files = fs.readdirSync(handoffsDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = readText(path.join(handoffsDir, file));
        if (!content) continue;
        const beadId = file.replace(/\.md$/, '');
        handoffs.push({
          beadId,
          beadState: { title: this.extractTitle(content), status: 'unknown' },
          decisions: [],
          modifiedFiles: [],
          blockers: [],
          openQuestions: [],
          nextSteps: [],
          criticalContext: content,
        });
      }
    } catch {
      // No handoffs directory yet -- return empty
    }

    return handoffs;
  }

  async acknowledgeHandoff(threadId: string): Promise<void> {
    // Write a .ack sidecar file alongside the handoff document.
    // threadId for fs-only handoffs is the beadId (file stem).
    // We walk all features to find the matching handoff file.
    const featuresBase = path.join(this.projectRoot, '.maestro', 'features');
    try {
      const features = fs.readdirSync(featuresBase, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);

      for (const feat of features) {
        const handoffsDir = getHandoffsPath(this.projectRoot, feat);
        const safeName = threadId.replace(/[^a-z0-9-]/gi, '-');
        const handoffFile = path.join(handoffsDir, `${safeName}.md`);
        if (fileExists(handoffFile)) {
          writeText(`${handoffFile}.ack`, new Date().toISOString());
          return;
        }
      }
    } catch {
      // Best-effort
    }
  }

  private getModifiedFiles(): string[] {
    try {
      const stdout = execFileSync('git', ['diff', '--name-only'], {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: 5000,
      });
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private formatHandoff(handoff: HandoffDocument, feature: string): string {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const sections: string[] = [];

    sections.push(`## Handoff: ${timestamp}`, '');
    sections.push('### Current Task State');
    sections.push(`Task: \`${handoff.beadId}\` | Status: ${handoff.beadState.status}`);
    sections.push(`Title: ${handoff.beadState.title}`, '');

    if (handoff.decisions.length > 0) {
      sections.push('### Key Decisions');
      for (const d of handoff.decisions) sections.push(`- **${d.key}**: ${d.value}`);
      sections.push('');
    }

    if (handoff.modifiedFiles.length > 0) {
      sections.push('### Modified Files');
      for (const f of handoff.modifiedFiles) sections.push(`- \`${f}\``);
      sections.push('');
    }

    if (handoff.blockers.length > 0) {
      sections.push('### Blockers');
      for (const b of handoff.blockers) sections.push(`- ${b}`);
      sections.push('');
    }

    if (handoff.criticalContext) {
      sections.push('### Critical Context', handoff.criticalContext, '');
    }

    sections.push('### Handoff Context (for next session)');
    sections.push(`1. Read this handoff file for full context on task \`${handoff.beadId}\`.`);
    sections.push(`2. Run: \`maestro task-info --feature ${feature} --task ${handoff.beadId}\` for current task state.`);
    if (handoff.cassPointer) sections.push(`3. ${handoff.cassPointer}`);
    sections.push('');

    return sections.join('\n');
  }

  private extractTitle(content: string): string {
    const match = content.match(/^##\s+Handoff:\s+(.+)$/m);
    return match ? match[1].trim() : 'Unknown';
  }
}
