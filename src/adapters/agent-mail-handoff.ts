/**
 * AgentMailHandoffAdapter -- HandoffPort implementation using Agent Mail HTTP MCP.
 *
 * Builds handoff documents from br bead state + maestro memory + git diff,
 * then sends/receives via Agent Mail's HTTP API.
 */

import type { HandoffPort, HandoffDocument } from '../ports/handoff.ts';
import type { TaskPort, RichTaskFields } from '../ports/tasks.ts';
import type { MemoryPort } from '../ports/memory.ts';
import { execFileSync } from 'node:child_process';

const DEFAULT_AGENT_MAIL_URL = 'http://localhost:8765';

export class AgentMailHandoffAdapter implements HandoffPort {
  private baseUrl: string;
  private projectRoot: string;
  private taskPort: TaskPort;
  private memoryAdapter: MemoryPort;

  constructor(
    projectRoot: string,
    taskPort: TaskPort,
    memoryAdapter: MemoryPort,
    agentMailUrl?: string,
  ) {
    this.projectRoot = projectRoot;
    this.taskPort = taskPort;
    this.memoryAdapter = memoryAdapter;
    this.baseUrl = agentMailUrl ?? process.env.AGENT_MAIL_URL ?? DEFAULT_AGENT_MAIL_URL;
  }

  async buildHandoff(feature: string, taskId: string): Promise<HandoffDocument> {
    // Get bead state
    const task = await this.taskPort.get(feature, taskId);
    const richFields: RichTaskFields | null = this.taskPort.getRichFields
      ? await this.taskPort.getRichFields(feature, taskId)
      : null;

    // Get memories
    const memories = this.memoryAdapter.list(feature);
    const decisions = memories.map(mf => ({
      key: mf.name,
      value: mf.content.slice(0, 500),
    }));

    // Get modified files from git
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

  async sendHandoff(handoff: HandoffDocument, targetAgent?: string): Promise<{ threadId: string }> {
    const threadId = `bead:${handoff.beadId}`;
    const body = this.formatHandoffMessage(handoff);

    const payload = {
      jsonrpc: '2.0',
      id: `handoff-${Date.now()}`,
      method: 'tools/call',
      params: {
        name: 'send_message',
        arguments: {
          project_key: this.projectRoot,
          from_agent: 'maestro',
          to_agents: targetAgent ? [targetAgent] : [],
          subject: `[${handoff.beadId}] Handoff: ${handoff.beadState.title}`,
          body,
          thread_id: threadId,
          importance: 'high',
        },
      },
    };

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.HTTP_BEARER_TOKEN ? { Authorization: `Bearer ${process.env.HTTP_BEARER_TOKEN}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Agent Mail request failed: ${response.status} ${response.statusText}`);
    }

    return { threadId };
  }

  async receiveHandoffs(agentId: string): Promise<HandoffDocument[]> {
    const payload = {
      jsonrpc: '2.0',
      id: `inbox-${Date.now()}`,
      method: 'tools/call',
      params: {
        name: 'fetch_inbox',
        arguments: {
          project_key: this.projectRoot,
          agent_name: agentId,
          limit: 20,
        },
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.HTTP_BEARER_TOKEN ? { Authorization: `Bearer ${process.env.HTTP_BEARER_TOKEN}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) return [];

      const result = await response.json() as Record<string, unknown>;
      const messages = (result.result as Record<string, unknown>)?.content as Array<Record<string, unknown>> ?? [];

      return messages
        .filter(m => String(m.thread_id ?? '').startsWith('bead:'))
        .map(m => this.parseHandoffMessage(m));
    } catch {
      return [];
    }
  }

  async acknowledgeHandoff(threadId: string): Promise<void> {
    const payload = {
      jsonrpc: '2.0',
      id: `ack-${Date.now()}`,
      method: 'tools/call',
      params: {
        name: 'acknowledge_message',
        arguments: {
          project_key: this.projectRoot,
          message_id: threadId,
          agent_name: 'maestro',
        },
      },
    };

    await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.HTTP_BEARER_TOKEN ? { Authorization: `Bearer ${process.env.HTTP_BEARER_TOKEN}` } : {}),
      },
      body: JSON.stringify(payload),
    });
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
    const sections: string[] = [];

    sections.push(`## Handoff: ${handoff.beadState.title}`);
    sections.push(`**Status:** ${handoff.beadState.status}`);
    sections.push('');

    if (handoff.beadState.description) {
      sections.push('### Current State');
      sections.push(handoff.beadState.description.slice(0, 2000));
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
      sections.push('### Blockers');
      for (const b of handoff.blockers) {
        sections.push(`- ${b}`);
      }
      sections.push('');
    }

    if (handoff.cassPointer) {
      sections.push('### Prior Context');
      sections.push(handoff.cassPointer);
      sections.push('');
    }

    return sections.join('\n');
  }

  private parseHandoffMessage(msg: Record<string, unknown>): HandoffDocument {
    const threadId = String(msg.thread_id ?? '');
    const beadId = threadId.replace('bead:', '');

    return {
      beadId,
      beadState: {
        title: String(msg.subject ?? '').replace(/^\[.*?\]\s*Handoff:\s*/, ''),
        status: 'unknown',
      },
      decisions: [],
      modifiedFiles: [],
      blockers: [],
      openQuestions: [],
      nextSteps: [],
      criticalContext: String(msg.body ?? ''),
      agentMailThread: threadId,
    };
  }
}
