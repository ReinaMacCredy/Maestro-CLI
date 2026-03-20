/**
 * AgentMailHandoffAdapter -- HandoffPort implementation.
 *
 * Writes handoff documents to local files (.maestro/features/<name>/handoffs/)
 * as the primary artifact, then sends via Agent Mail HTTP API as notification.
 * File is always written; Agent Mail is best-effort.
 */

import type { HandoffPort, HandoffDocument, HandoffResult } from '../ports/handoff.ts';
import type { TaskPort, RichTaskFields } from '../ports/tasks.ts';
import type { MemoryPort } from '../ports/memory.ts';
import type { FsConfigAdapter } from './fs/config.ts';
import { selectMemories } from '../utils/context-selector.ts';
import { resolveDcpConfig } from '../utils/dcp-config.ts';
import { getHandoffPath, getHandoffsPath } from '../utils/paths.ts';
import { ensureDir, writeText, readText } from '../utils/fs-io.ts';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DEFAULT_AGENT_MAIL_URL = 'http://localhost:8765';

interface AgentMailIdentity {
  agentName: string;
  projectSlug: string;
}

export class AgentMailHandoffAdapter implements HandoffPort {
  private baseUrl: string;
  private projectRoot: string;
  private taskPort: TaskPort;
  private memoryAdapter: MemoryPort;
  private configAdapter: FsConfigAdapter;
  private identity: AgentMailIdentity | undefined;

  constructor(
    projectRoot: string,
    taskPort: TaskPort,
    memoryAdapter: MemoryPort,
    configAdapter: FsConfigAdapter,
    agentMailUrl?: string,
  ) {
    this.projectRoot = projectRoot;
    this.taskPort = taskPort;
    this.memoryAdapter = memoryAdapter;
    this.configAdapter = configAdapter;
    this.baseUrl = agentMailUrl ?? process.env.AGENT_MAIL_URL ?? DEFAULT_AGENT_MAIL_URL;
  }

  async buildHandoff(feature: string, taskId: string): Promise<HandoffDocument> {
    const task = await this.taskPort.get(feature, taskId);
    const richFields: RichTaskFields | null = this.taskPort.getRichFields
      ? await this.taskPort.getRichFields(feature, taskId)
      : null;

    const cfg = resolveDcpConfig(this.configAdapter.get().dcp);

    let decisions: Array<{ key: string; value: string }>;

    if (cfg.enabled && task) {
      const allMemories = this.memoryAdapter.listWithMeta(feature);
      const selected = selectMemories(
        allMemories, task, null, cfg.handoffDecisionBudgetBytes,
        cfg.relevanceThreshold,
      );
      decisions = selected.memories.map(m => ({
        key: m.name,
        value: m.bodyContent.slice(0, 500),
      }));
    } else {
      // Legacy: all memories, 500ch truncation (DCP disabled or task not found)
      const memories = this.memoryAdapter.list(feature);
      decisions = memories.map(mf => ({
        key: mf.name,
        value: mf.content.slice(0, 500),
      }));
    }

    const modifiedFiles = this.getModifiedFiles();

    return {
      beadId: taskId,
      beadState: {
        title: task?.planTitle ?? task?.name ?? taskId,
        status: task?.status ?? 'unknown',
        description: richFields?.description,
        design: richFields?.design,
        acceptanceCriteria: richFields?.acceptanceCriteria,
      },
      decisions,
      modifiedFiles,
      blockers: task?.status === 'blocked' ? [task.summary ?? 'Unknown blocker'] : [],
      openQuestions: [],
      nextSteps: [],
      criticalContext: '',
      cassPointer: `Search CASS for prior work: cass search "${task?.name ?? taskId}" --robot --limit 5`,
    };
  }

  private identityPath(): string {
    return path.join(this.projectRoot, '.maestro', '.agent-mail.json');
  }

  private async rpc(tool: string, args: Record<string, unknown>): Promise<{ isError: boolean; text?: string }> {
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.HTTP_BEARER_TOKEN ? { Authorization: `Bearer ${process.env.HTTP_BEARER_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `maestro-${Date.now()}`,
        method: 'tools/call',
        params: { name: tool, arguments: args },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { isError: true };
    const json = await response.json() as { result?: { isError?: boolean; content?: Array<{ text?: string }> } };
    return {
      isError: json.result?.isError ?? false,
      text: json.result?.content?.[0]?.text,
    };
  }

  private async ensureIdentity(): Promise<AgentMailIdentity | undefined> {
    if (this.identity) return this.identity;

    // Try cached identity from disk
    try {
      const raw = readText(this.identityPath());
      if (raw) {
        const cached = JSON.parse(raw) as AgentMailIdentity;
        if (cached.agentName && cached.projectSlug) {
          this.identity = cached;
          return this.identity;
        }
      }
    } catch { /* no cache or corrupt -- register fresh */ }

    // Register project
    const proj = await this.rpc('ensure_project', { human_key: this.projectRoot });
    if (proj.isError || !proj.text) return undefined;
    const projectSlug = JSON.parse(proj.text).slug as string;

    // Register agent (Agent Mail assigns the name)
    const agent = await this.rpc('register_agent', {
      project_key: this.projectRoot,
      program: 'maestro',
      model: 'orchestrator',
    });
    if (agent.isError || !agent.text) return undefined;
    const agentName = JSON.parse(agent.text).name as string;

    this.identity = { agentName, projectSlug };

    // Persist for future process invocations
    try {
      ensureDir(path.dirname(this.identityPath()));
      writeText(this.identityPath(), JSON.stringify(this.identity, null, 2));
    } catch { /* best-effort persistence */ }

    return this.identity;
  }

  async sendHandoff(feature: string, handoff: HandoffDocument, targetAgent?: string): Promise<HandoffResult> {
    const body = this.formatHandoffMessage(handoff);

    // 1. Write to local file (primary artifact)
    const filePath = getHandoffPath(this.projectRoot, feature, handoff.beadId);
    ensureDir(path.dirname(filePath));
    writeText(filePath, body);

    // 2. Try Agent Mail (best-effort notification)
    let agentMailSent = false;
    let threadId: string | undefined;

    try {
      threadId = `bead-${handoff.beadId}`;
      const id = await this.ensureIdentity();
      if (id) {
        const subject = targetAgent
          ? `[${handoff.beadId}] Handoff for ${targetAgent}: ${handoff.beadState.title}`
          : `[${handoff.beadId}] Handoff: ${handoff.beadState.title}`;
        const result = await this.rpc('send_message', {
          project_key: this.projectRoot,
          sender_name: id.agentName,
          to: [],
          subject,
          body_md: body,
          thread_id: threadId,
          importance: 'high',
          broadcast: true,
        });
        agentMailSent = !result.isError;
        if (agentMailSent && result.text) {
          try {
            const parsed = JSON.parse(result.text);
            const msgId = parsed.deliveries?.[0]?.payload?.id ?? parsed.id;
            threadId = String(msgId ?? threadId);
          } catch { /* keep string threadId as fallback */ }
        }
      }
    } catch {
      // Agent Mail unreachable -- file was still written
    }

    return { filePath, threadId, agentMailSent };
  }

  async receiveHandoffs(feature: string | undefined, _agentId?: string): Promise<HandoffDocument[]> {
    const handoffs: HandoffDocument[] = [];

    if (!feature) return handoffs;

    // Read local handoff files
    const handoffsDir = getHandoffsPath(this.projectRoot, feature);
    try {
      const files = fs.readdirSync(handoffsDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = readText(path.join(handoffsDir, file));
        if (!content) continue;
        const beadId = file.replace(/\.md$/, '');
        handoffs.push({
          beadId,
          beadState: {
            title: this.extractTitle(content),
            status: 'unknown',
          },
          decisions: [],
          modifiedFiles: [],
          blockers: [],
          openQuestions: [],
          nextSteps: [],
          criticalContext: content,
        });
      }
    } catch {
      // No handoffs directory yet
    }

    return handoffs;
  }

  async acknowledgeHandoff(threadId: string): Promise<void> {
    const msgId = parseInt(threadId, 10);
    if (isNaN(msgId)) return; // Not a valid Agent Mail message ID -- skip silently

    try {
      const id = await this.ensureIdentity();
      if (!id) return;
      await this.rpc('acknowledge_message', {
        project_key: this.projectRoot,
        message_id: msgId,
        agent_name: id.agentName,
      });
    } catch {
      // Best-effort
    }
  }

  // -- Private helpers --

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

  private formatHandoffMessage(handoff: HandoffDocument): string {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const sections: string[] = [];

    sections.push(`## Handoff: ${timestamp}`);
    sections.push('');

    sections.push('### Current Task State');
    sections.push(`Bead: \`${handoff.beadId}\` | Status: ${handoff.beadState.status}`);
    sections.push(`Title: ${handoff.beadState.title}`);
    sections.push('');

    if (handoff.beadState.description) {
      sections.push('### Description');
      sections.push(handoff.beadState.description.slice(0, 2000));
      sections.push('');
    }

    if (handoff.beadState.design) {
      sections.push('### Design Notes');
      sections.push(handoff.beadState.design);
      sections.push('');
    }

    if (handoff.beadState.acceptanceCriteria) {
      sections.push('### Acceptance Criteria');
      sections.push(handoff.beadState.acceptanceCriteria);
      sections.push('');
    }

    if (handoff.decisions.length > 0) {
      sections.push('### Key Decisions');
      for (const d of handoff.decisions) {
        sections.push(`- **${d.key}**: ${d.value}`);
      }
      sections.push('');
    }

    if (handoff.modifiedFiles.length > 0) {
      sections.push('### Modified Files');
      for (const f of handoff.modifiedFiles) {
        sections.push(`- \`${f}\``);
      }
      sections.push('');
    }

    if (handoff.blockers.length > 0) {
      sections.push('### Blockers / Open Questions');
      for (const b of handoff.blockers) {
        sections.push(`- ${b}`);
      }
      sections.push('');
    }

    if (handoff.criticalContext) {
      sections.push('### Critical Context');
      sections.push(handoff.criticalContext);
      sections.push('');
    }

    if (handoff.nextSteps.length > 0) {
      sections.push('### Next Steps');
      for (let i = 0; i < handoff.nextSteps.length; i++) {
        sections.push(`${i + 1}. ${handoff.nextSteps[i]}`);
      }
      sections.push('');
    }

    // CASS pointer for session continuity
    if (handoff.cassPointer) {
      sections.push('### Prior Context');
      sections.push(handoff.cassPointer);
      sections.push('');
    }

    // Handoff instructions for receiving agent
    sections.push('### Handoff Context (for next session)');
    sections.push(`1. Read this handoff file for full context on bead \`${handoff.beadId}\`.`);
    sections.push(`2. Run: \`br show ${handoff.beadId} --json\` for current bead state.`);
    sections.push(`3. ${handoff.cassPointer ?? 'Search CASS for prior work on this task.'}`);
    sections.push('');

    return sections.join('\n');
  }

  private extractTitle(content: string): string {
    const match = content.match(/^##\s+Handoff:\s+(.+)$/m);
    return match ? match[1].trim() : 'Unknown';
  }
}
