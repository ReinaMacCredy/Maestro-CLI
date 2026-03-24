/**
 * ToolboxRegistry -- resolves port providers from manifests + settings.
 */

import { isToolAllowed } from '../core/settings.ts';
import type { MaestroSettings } from '../core/settings.ts';
import { scanBuiltInManifests, detectTool, clearDetectCache } from './loader.ts';
import type { ToolManifest, ToolStatus } from './types.ts';

export class ToolboxRegistry {
  private statuses: ToolStatus[];
  private byName: Map<string, ToolStatus>;

  constructor(manifests: ToolManifest[], settings: MaestroSettings) {
    const allowDeny = { allow: settings.toolbox.allow, deny: settings.toolbox.deny };

    this.statuses = manifests.map((m) => detectTool(m, allowDeny));
    this.byName = new Map(this.statuses.map((s) => [s.manifest.name, s]));
  }

  /**
   * Find the highest-priority installed + allowed tool for a port.
   * Returns null if no provider is available.
   */
  resolveProvider(portName: string): ToolManifest | null {
    const candidates = this.statuses
      .filter((s) =>
        s.manifest.provides === portName &&
        s.installed &&
        s.settingsState !== 'denied',
      )
      .sort((a, b) => b.manifest.priority - a.manifest.priority);

    return candidates[0]?.manifest ?? null;
  }

  /** All tool statuses for diagnostics / doctor. */
  getStatus(): ToolStatus[] {
    return [...this.statuses];
  }

  /** Check if a specific tool is installed AND not denied. */
  isAvailable(toolName: string): boolean {
    const status = this.byName.get(toolName);
    if (!status) return false;
    return status.installed && status.settingsState !== 'denied';
  }

  /** Get manifest by tool name. */
  getManifest(toolName: string): ToolManifest | null {
    return this.byName.get(toolName)?.manifest ?? null;
  }
}

/**
 * Build the full toolbox: scan manifests, detect tools, construct registry.
 */
export function buildToolbox(settings: MaestroSettings): ToolboxRegistry {
  const manifests = scanBuiltInManifests();
  return new ToolboxRegistry(manifests, settings);
}
