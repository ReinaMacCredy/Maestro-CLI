/**
 * AGENTS.md adapter for maestroCLI.
 * Forked from hive-core/src/services/agentsMdService.ts -- direct copy.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileExists, readText, writeText } from '../utils/fs-io.ts';
import type { ContextFile } from '../types.ts';
import type { FsContextAdapter } from './fs-context.ts';

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
    private readonly contextAdapter: FsContextAdapter,
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
    const contexts: ContextFile[] = this.contextAdapter.list(featureName);
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

  private extractFindings(contexts: ContextFile[]): string[] {
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

    return sections.join('\n');
  }
}

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
