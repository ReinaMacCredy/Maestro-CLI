/**
 * AgentToolsRegistry -- detects agent tools, loads guidance, assembles protocols.
 */

import * as fs from 'fs';
import * as path from 'path';
import { isToolAllowed } from '../../core/settings.ts';
import type { AgentToolsSettings } from '../../core/settings.ts';
import { scanAgentTools, detectAgentTool } from './loader.ts';
import type { AgentToolManifest, AgentToolStatus } from './types.ts';

export class AgentToolsRegistry {
  private statuses: AgentToolStatus[];
  private byName: Map<string, AgentToolStatus>;
  private settings: AgentToolsSettings;

  constructor(manifests: AgentToolManifest[], settings: AgentToolsSettings) {
    this.settings = settings;
    this.statuses = manifests.map((m) => detectAgentTool(m));
    this.byName = new Map(this.statuses.map((s) => [s.manifest.name, s]));
  }

  /** All agent tool statuses for diagnostics. */
  getAll(): AgentToolStatus[] {
    return [...this.statuses];
  }

  /** Only installed tools that pass allow/deny. */
  getInstalled(): AgentToolStatus[] {
    return this.statuses.filter((s) =>
      s.installed && isToolAllowed(s.manifest.name, this.settings),
    );
  }

  /** Check if a specific tool is installed AND allowed. */
  isAvailable(name: string): boolean {
    const status = this.byName.get(name);
    if (!status) return false;
    return status.installed && isToolAllowed(name, this.settings);
  }

  /** Load guidance.md content for a tool. Returns null if not found. */
  getGuidance(name: string): string | null {
    const builtInPath = path.join(import.meta.dir, 'built-in', name, 'guidance.md');
    try {
      return fs.readFileSync(builtInPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Assemble a protocol document with sections adapted to installed tools.
   * Reads from protocols/<name>.md and filters conditional sections.
   */
  assembleProtocol(protocolName: string): string | null {
    const protocolPath = path.join(import.meta.dir, 'protocols', `${protocolName}.md`);
    try {
      const raw = fs.readFileSync(protocolPath, 'utf-8');
      return this.filterConditionalSections(raw);
    } catch {
      return null;
    }
  }

  /**
   * Filter conditional sections based on installed tools.
   * Syntax: <!-- [if:tool1,tool2] --> includes if both installed
   *         <!-- [if:tool1,!tool2] --> includes if tool1 but not tool2
   */
  private filterConditionalSections(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let inConditional = false;
    let conditionMet = false;

    for (const line of lines) {
      const condMatch = line.match(/<!--\s*\[if:([^\]]+)\]\s*/);
      if (condMatch) {
        inConditional = true;
        const conditions = condMatch[1].split(',').map(c => c.trim());
        conditionMet = conditions.every((c) => {
          if (c.startsWith('!')) return !this.isAvailable(c.slice(1));
          return this.isAvailable(c);
        });
        if (conditionMet) {
          // Include the comment line content after the condition marker
          const after = line.replace(/<!--\s*\[if:[^\]]+\]\s*/, '').replace(/\s*-->/, '').trim();
          if (after) result.push(after);
        }
        continue;
      }

      if (inConditional && line.trim() === '') {
        inConditional = false;
        conditionMet = false;
        result.push('');
        continue;
      }

      if (inConditional) {
        if (conditionMet) {
          // Strip comment markers if the line is wrapped in <!-- -->
          const stripped = line.replace(/^<!--\s*/, '').replace(/\s*-->$/, '').trim();
          if (stripped) result.push(stripped);
        }
        continue;
      }

      result.push(line);
    }

    return result.join('\n');
  }
}

/**
 * Build the agent tools registry from built-in manifests + settings.
 */
export function buildAgentToolsRegistry(settings: AgentToolsSettings): AgentToolsRegistry {
  const manifests = scanAgentTools();
  return new AgentToolsRegistry(manifests, settings);
}
