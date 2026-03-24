/**
 * FsSettingsAdapter: reads layered settings.json files and auto-migrates
 * from config.json when no settings.json exists.
 *
 * Layers (lowest to highest precedence):
 *   DEFAULT_SETTINGS -> ~/.maestro/settings.json -> .maestro/settings.json
 */

import * as path from 'path';
import { homedir } from 'os';
import { readJson } from './fs-io.ts';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type MaestroSettings,
  type SettingsPort,
} from './settings.ts';
import type { HiveConfig } from './types.ts';

export class FsSettingsAdapter implements SettingsPort {
  private globalPath: string;
  private projectPath: string;
  private legacyConfigPath: string;
  private cached: MaestroSettings | null = null;

  constructor(private directory: string, globalDir?: string) {
    const gDir = globalDir ?? path.join(homedir(), '.maestro');
    this.globalPath = path.join(gDir, 'settings.json');
    this.projectPath = path.join(directory, '.maestro', 'settings.json');
    this.legacyConfigPath = path.join(gDir, 'config.json');
  }

  get(): MaestroSettings {
    if (this.cached) return this.cached;

    const globalOverlay = readJson<Partial<MaestroSettings>>(this.globalPath) ?? {};
    const projectOverlay = readJson<Partial<MaestroSettings>>(this.projectPath) ?? {};

    // If neither settings.json exists, try migrating from config.json
    const hasSettings = Object.keys(globalOverlay).length > 0 || Object.keys(projectOverlay).length > 0;
    if (!hasSettings) {
      const legacy = readJson<Partial<HiveConfig>>(this.legacyConfigPath);
      if (legacy) {
        const migrated = migrateFromConfig(legacy);
        this.cached = mergeSettings(DEFAULT_SETTINGS, migrated);
        return this.cached;
      }
    }

    this.cached = mergeSettings(DEFAULT_SETTINGS, globalOverlay, projectOverlay);
    return this.cached;
  }

  getToolConfig(name: string): Record<string, unknown> {
    const settings = this.get();
    return settings.toolbox.config[name] ?? {};
  }

  /** Clear cache so next get() re-reads from disk. */
  invalidate(): void {
    this.cached = null;
  }

  /** Get agent-specific config with defaults merged and skill filtering. */
  getAgentConfig(agentName: string): {
    model?: string; temperature?: number; skills?: string[];
    autoLoadSkills?: string[]; variant?: string;
  } {
    const settings = this.get();
    const agentConfig = settings.agents[agentName] ?? {};
    const defaultAutoLoad = agentConfig.autoLoadSkills ?? [];
    return { ...agentConfig, autoLoadSkills: defaultAutoLoad };
  }

  /** Paths exposed for CLI/diagnostics. */
  getGlobalPath(): string { return this.globalPath; }
  getProjectPath(): string { return this.projectPath; }
}

// ============================================================================
// Config Migration
// ============================================================================

/**
 * Map legacy HiveConfig fields to MaestroSettings.
 * Read-time only -- never writes to disk.
 */
export function migrateFromConfig(config: Partial<HiveConfig>): Partial<MaestroSettings> {
  const result: Partial<MaestroSettings> = {};

  // tasks section
  if (config.taskBackend !== undefined || config.claimExpiresMinutes !== undefined) {
    result.tasks = {
      ...DEFAULT_SETTINGS.tasks,
      ...(config.taskBackend !== undefined ? { backend: config.taskBackend } : {}),
      ...(config.claimExpiresMinutes !== undefined ? { claimExpiresMinutes: config.claimExpiresMinutes } : {}),
    };
  }

  // toolbox allow/deny
  if (config.enableToolsFor !== undefined || config.disableMcps !== undefined) {
    result.toolbox = {
      ...DEFAULT_SETTINGS.toolbox,
      ...(config.enableToolsFor ? { allow: config.enableToolsFor } : {}),
      ...(config.disableMcps ? { deny: config.disableMcps } : {}),
    };
  }

  // dcp section
  if (config.dcp) {
    const d = config.dcp;
    result.dcp = {
      ...DEFAULT_SETTINGS.dcp,
      ...(d.enabled !== undefined ? { enabled: d.enabled } : {}),
      ...(d.memoryBudgetTokens !== undefined
        ? { memoryBudgetTokens: d.memoryBudgetTokens }
        : d.memoryBudgetBytes !== undefined
          ? { memoryBudgetTokens: Math.round(d.memoryBudgetBytes / 4) }
          : {}),
      ...(d.completedTaskBudgetTokens !== undefined
        ? { completedTaskBudgetTokens: d.completedTaskBudgetTokens }
        : d.completedTaskBudgetBytes !== undefined
          ? { completedTaskBudgetTokens: Math.round(d.completedTaskBudgetBytes / 4) }
          : {}),
      ...(d.handoffDecisionBudgetTokens !== undefined
        ? { handoffDecisionBudgetTokens: d.handoffDecisionBudgetTokens }
        : d.handoffDecisionBudgetBytes !== undefined
          ? { handoffDecisionBudgetTokens: Math.round(d.handoffDecisionBudgetBytes / 4) }
          : {}),
      ...(d.relevanceThreshold !== undefined ? { relevanceThreshold: d.relevanceThreshold } : {}),
      ...(d.observationMasking !== undefined ? { observationMasking: d.observationMasking } : {}),
    };
  }

  // verification section
  if (config.verification) {
    const v = config.verification;
    result.verification = {
      ...DEFAULT_SETTINGS.verification,
      ...(v.enabled !== undefined ? { enabled: v.enabled } : {}),
      ...(v.autoReject !== undefined ? { autoReject: v.autoReject } : {}),
      ...(v.maxRevisions !== undefined ? { maxRevisions: v.maxRevisions } : {}),
      ...(v.scoreThreshold !== undefined ? { scoreThreshold: v.scoreThreshold } : {}),
      ...(v.buildTimeoutMs !== undefined ? { buildTimeoutMs: v.buildTimeoutMs } : {}),
      ...(v.buildCommand !== undefined ? { buildCommand: v.buildCommand } : {}),
    };
  }

  // doctrine section
  if (config.doctrine) {
    const dc = config.doctrine;
    result.doctrine = {
      ...DEFAULT_SETTINGS.doctrine,
      ...(dc.enabled !== undefined ? { enabled: dc.enabled } : {}),
      ...(dc.doctrineBudgetTokens !== undefined
        ? { doctrineBudgetTokens: dc.doctrineBudgetTokens }
        : dc.doctrineBudgetBytes !== undefined
          ? { doctrineBudgetTokens: Math.round(dc.doctrineBudgetBytes / 4) }
          : {}),
      ...(dc.maxSuggestionsPerFeature !== undefined ? { maxSuggestionsPerFeature: dc.maxSuggestionsPerFeature } : {}),
      ...(dc.crossFeatureScanLimit !== undefined ? { crossFeatureScanLimit: dc.crossFeatureScanLimit } : {}),
      ...(dc.minSampleSize !== undefined ? { minSampleSize: dc.minSampleSize } : {}),
    };
  }

  // agents section
  if (config.agents) {
    const agents: Record<string, { model?: string; temperature?: number; skills?: string[]; autoLoadSkills?: string[]; variant?: string }> = {};
    for (const [name, cfg] of Object.entries(config.agents)) {
      if (cfg) agents[name] = { ...cfg };
    }
    result.agents = agents;
  }

  return result;
}
