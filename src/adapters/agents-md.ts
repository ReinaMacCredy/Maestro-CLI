/**
 * AGENTS.md adapter for maestroCLI.
 * Forked from hive-core/src/services/agentsMdService.ts -- direct copy.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileExists, readText, writeText } from '../utils/fs-io.ts';
import type { MemoryFile } from '../types.ts';
import type { FsMemoryAdapter } from './fs/memory.ts';
import { execFileSync } from 'node:child_process';

export interface InitResult {
  content: string;
  existed: boolean;
}

export interface SyncResult {
  proposals: string[];
  diff: string;
}

export interface ApplyResult {
  path: string;
  chars: number;
  isNew: boolean;
}

export class AgentsMdAdapter {
  constructor(
    private readonly rootDir: string,
    private readonly memoryAdapter: FsMemoryAdapter,
  ) {}

  async init(): Promise<InitResult> {
    const agentsMdPath = path.join(this.rootDir, 'AGENTS.md');
    const existed = fileExists(agentsMdPath);

    if (existed) {
      const existing = readText(agentsMdPath);
      return { content: existing || '', existed: true };
    }

    const content = await this.scanAndGenerate();
    return { content, existed: false };
  }

  async sync(featureName: string): Promise<SyncResult> {
    const contexts: MemoryFile[] = this.memoryAdapter.list(featureName);
    const agentsMdPath = path.join(this.rootDir, 'AGENTS.md');
    const current = await fs.promises.readFile(agentsMdPath, 'utf-8').catch(() => '');
    const findings = this.extractFindings(contexts);
    const proposals = this.generateProposals(findings, current);
    return { proposals, diff: this.formatDiff(current, proposals) };
  }

  apply(content: string): ApplyResult {
    const agentsMdPath = path.join(this.rootDir, 'AGENTS.md');
    const isNew = !fileExists(agentsMdPath);
    writeText(agentsMdPath, content);
    return { path: agentsMdPath, chars: content.length, isNew };
  }

  private extractFindings(contexts: MemoryFile[]): string[] {
    const findings: string[] = [];
    const patterns = [
      /we\s+use\s+[^.\n]+/gi,
      /prefer\s+[^.\n]+\s+over\s+[^.\n]+/gi,
      /don't\s+use\s+[^.\n]+/gi,
      /do\s+not\s+use\s+[^.\n]+/gi,
      /(?:build|test|dev)\s+command:\s*[^.\n]+/gi,
      /[a-zA-Z]+\s+lives?\s+in\s+\/[^\s.\n]+/gi,
    ];

    for (const context of contexts) {
      const lines = context.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        for (const pattern of patterns) {
          const matches = trimmed.match(pattern);
          if (matches) {
            for (const match of matches) {
              const finding = match.trim();
              if (finding && !findings.includes(finding)) {
                findings.push(finding);
              }
            }
          }
        }
      }
    }

    return findings;
  }

  private generateProposals(findings: string[], current: string): string[] {
    const proposals: string[] = [];
    const currentLower = current.toLowerCase();

    for (const finding of findings) {
      const findingLower = finding.toLowerCase();
      if (!currentLower.includes(findingLower)) {
        proposals.push(finding);
      }
    }

    return proposals;
  }

  private formatDiff(current: string, proposals: string[]): string {
    if (proposals.length === 0) return '';
    const lines = proposals.map(p => `+ ${p}`);
    return lines.join('\n');
  }

  private async scanAndGenerate(): Promise<string> {
    const detections = await this.detectProjectInfo();
    return this.generateTemplate(detections);
  }

  private async detectProjectInfo(): Promise<ProjectInfo> {
    const packageJsonPath = path.join(this.rootDir, 'package.json');
    let packageJson: PackageJson | null = null;

    if (fileExists(packageJsonPath)) {
      try {
        const content = readText(packageJsonPath);
        packageJson = content ? JSON.parse(content) : null;
      } catch {
        // Invalid JSON
      }
    }

    return {
      packageManager: this.detectPackageManager(),
      language: this.detectLanguage(),
      testFramework: this.detectTestFramework(packageJson),
      buildCommand: packageJson?.scripts?.build || null,
      testCommand: packageJson?.scripts?.test || null,
      devCommand: packageJson?.scripts?.dev || null,
      isMonorepo: this.detectMonorepo(packageJson),
    };
  }

  private detectPackageManager(): string {
    if (fileExists(path.join(this.rootDir, 'bun.lockb'))) return 'bun';
    if (fileExists(path.join(this.rootDir, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fileExists(path.join(this.rootDir, 'yarn.lock'))) return 'yarn';
    if (fileExists(path.join(this.rootDir, 'package-lock.json'))) return 'npm';
    return 'npm';
  }

  private detectLanguage(): string {
    if (fileExists(path.join(this.rootDir, 'tsconfig.json'))) return 'TypeScript';
    if (fileExists(path.join(this.rootDir, 'package.json'))) return 'JavaScript';
    if (fileExists(path.join(this.rootDir, 'requirements.txt'))) return 'Python';
    if (fileExists(path.join(this.rootDir, 'go.mod'))) return 'Go';
    if (fileExists(path.join(this.rootDir, 'Cargo.toml'))) return 'Rust';
    return 'Unknown';
  }

  private detectTestFramework(packageJson: PackageJson | null): string | null {
    if (!packageJson) return null;
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (deps?.vitest) return 'vitest';
    if (deps?.jest) return 'jest';
    if (this.detectPackageManager() === 'bun') return 'bun test';
    if (deps?.pytest) return 'pytest';
    return null;
  }

  private detectMonorepo(packageJson: PackageJson | null): boolean {
    if (!packageJson) return false;
    return !!packageJson.workspaces;
  }

  private generateTemplate(info: ProjectInfo): string {
    const sections: string[] = [];
    sections.push('# Agent Guidelines\n');
    sections.push('## Overview\n');
    sections.push('This project uses AI-assisted development. Follow these guidelines.\n');
    sections.push('## Build & Test Commands\n');
    sections.push('```bash');

    if (info.isMonorepo) {
      sections.push('# This is a monorepo using bun workspaces');
    }
    if (info.buildCommand) {
      sections.push(`# Build`);
      sections.push(`${info.packageManager} run build`);
      sections.push('');
    }
    if (info.testCommand) {
      sections.push(`# Run tests`);
      sections.push(`${info.packageManager} ${info.testCommand === 'bun test' ? 'test' : 'run test'}`);
      sections.push('');
    }
    if (info.devCommand) {
      sections.push(`# Development mode`);
      sections.push(`${info.packageManager} run dev`);
    }
    sections.push('```\n');

    sections.push('## Technology Stack\n');
    sections.push(`- **Language**: ${info.language}`);
    sections.push(`- **Package Manager**: ${info.packageManager}`);
    if (info.testFramework) {
      sections.push(`- **Test Framework**: ${info.testFramework}`);
    }
    if (info.isMonorepo) {
      sections.push(`- **Structure**: Monorepo with workspaces`);
    }
    sections.push('');
    sections.push('## Code Style\n');
    sections.push('Follow existing patterns in the codebase.\n');
    sections.push('## Architecture Principles\n');
    sections.push('Document key architectural decisions here.\n');

    // Tool blurbs (conditional on availability)
    const toolBlurbs = this.generateToolBlurbs();
    if (toolBlurbs) {
      sections.push(toolBlurbs);
    }

    return sections.join('\n');
  }

  /** Generate AGENTS.md blurbs for available external tools (flywheel style). */
  generateToolBlurbs(): string | null {
    const sections: string[] = [];

    if (this.isToolAvailable('br')) {
      sections.push(BLURB_BEADS);
    }

    if (this.isToolAvailable('bv')) {
      sections.push(BLURB_BV);
    }

    if (this.isToolAvailable('cass')) {
      sections.push(BLURB_CASS);
    }

    // Agent Mail: check if server is reachable (best effort)
    try {
      // Check for am alias or MCP config
      if (this.isToolAvailable('am') || process.env.AGENT_MAIL_URL) {
        sections.push(BLURB_AGENT_MAIL);
      }
    } catch { /* skip */ }

    return sections.length > 0 ? sections.join('\n') : null;
  }

  private isToolAvailable(binary: string): boolean {
    try {
      execFileSync('command', ['-v', binary], { stdio: 'pipe', shell: true });
      return true;
    } catch {
      return false;
    }
  }
}

// -- Tool blurbs (flywheel style: always in context, re-read after compaction) --

const BLURB_BEADS = `## br (beads) -- Agent-first issue tracker

- **Status mapping**: open=pending, in_progress=claimed, deferred=blocked, closed=done
- **Ready work**: \`br ready --json\` (unblocked, not deferred)
- **Claim**: \`br update <id> --claim\` (atomic: sets assignee + in_progress)
- **Close**: \`br close <id> -r "summary" --suggest-next\`
- **Dependencies**: \`br dep add <id> <dep-id>\`, \`br dep tree <id>\`
- **Rich fields**: \`--description\`, \`--design\`, \`--acceptance\`, \`--notes\`
- Use bead ID as commit message tag and Agent Mail thread_id for traceability.
`;

const BLURB_BV = `## bv (beads viewer) -- Graph-aware task routing

Always use --robot-* flags (never bare bv which launches TUI).

| Command | Purpose |
|---------|---------|
| \`bv -robot-triage\` | Unified AI triage recommendations |
| \`bv -robot-next\` | Single top pick with scoring |
| \`bv -robot-plan -agents N\` | Parallel execution tracks |
| \`bv -robot-insights\` | PageRank, betweenness, critical path |

Add \`-format json\` for structured output.
`;

const BLURB_CASS = `## cass -- Search all agent session history

[!] NEVER run bare cass (launches interactive TUI). Always use --robot or --json.

\`\`\`bash
cass health                                    # Check index health
cass search "query" --robot --limit 5          # Search across all agents
cass view /path/to/session.jsonl -n 42 --json  # View specific result
cass expand /path/to/session.jsonl -n 42 -C 3 --json  # Expand context
\`\`\`

Key flags: \`--fields minimal\`, \`--limit N\`, \`--agent NAME\`, \`--days N\`.
stdout = data only, stderr = diagnostics.
`;

const BLURB_AGENT_MAIL = `## Agent Mail -- Multi-agent coordination

1. Register: \`ensure_project\` then \`register_agent\` with repo path as project_key
2. Reserve files: \`file_reservation_paths(project_key, agent_name, ["src/**"], ttl_seconds=3600, exclusive=true)\`
3. Communicate: \`send_message(..., thread_id="<bead-id>")\`; check \`fetch_inbox\`; \`acknowledge_message\`
4. Conventions: bead ID as thread_id, \`[<bead-id>]\` subject prefix, bead ID in reservation reason
5. Release reservations when done: \`release_file_reservations\`

Macros for speed: \`macro_start_session\`, \`macro_file_reservation_cycle\`.
`;

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
}

interface ProjectInfo {
  packageManager: string;
  language: string;
  testFramework: string | null;
  buildCommand: string | null;
  testCommand: string | null;
  devCommand: string | null;
  isMonorepo: boolean;
}
