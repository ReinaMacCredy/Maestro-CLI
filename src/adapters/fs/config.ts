/**
 * Filesystem-based config adapter for maestroCLI.
 * Forked from hive-core/src/services/configService.ts.
 * Adapted: config path ~/.config/opencode/ --> ~/.config/maestro/.
 *          SandboxConfig imported from types.ts instead of dockerSandboxService.
 *          Constructor takes no directory arg (user-scoped).
 */

import * as path from 'path';
import { HiveConfig, DEFAULT_HIVE_CONFIG, AGENT_NAMES } from '../../types.ts';
import type { SandboxConfig, AgentName } from '../../types.ts';
import { ensureDir, readJson, writeJsonAtomic, fileExists } from '../../utils/fs-io.ts';
import { SKILL_ALIASES } from '../../skills/registry.ts';

export class FsConfigAdapter {
  private configPath: string;
  private cachedConfig: HiveConfig | null = null;

  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const configDir = path.join(homeDir, '.config', 'maestro');
    this.configPath = path.join(configDir, 'config.json');
  }

  getPath(): string {
    return this.configPath;
  }

  get(): HiveConfig {
    if (this.cachedConfig !== null) {
      return this.cachedConfig;
    }
    try {
      const stored = readJson<Partial<HiveConfig>>(this.configPath);
      if (!stored) {
        this.cachedConfig = { ...DEFAULT_HIVE_CONFIG };
        return this.cachedConfig;
      }

      const agents: HiveConfig['agents'] = { ...DEFAULT_HIVE_CONFIG.agents };
      for (const name of AGENT_NAMES) {
        agents[name] = { ...DEFAULT_HIVE_CONFIG.agents?.[name], ...stored.agents?.[name] };
      }
      const merged: HiveConfig = { ...DEFAULT_HIVE_CONFIG, ...stored, agents };
      this.cachedConfig = merged;
      return this.cachedConfig;
    } catch {
      this.cachedConfig = { ...DEFAULT_HIVE_CONFIG };
      return this.cachedConfig;
    }
  }

  set(updates: Partial<HiveConfig>): HiveConfig {
    this.cachedConfig = null;
    const current = this.get();

    const merged: HiveConfig = {
      ...current,
      ...updates,
      agents: updates.agents ? {
        ...current.agents,
        ...updates.agents,
      } : current.agents,
    };

    ensureDir(path.dirname(this.configPath));
    writeJsonAtomic(this.configPath, merged);
    this.cachedConfig = merged;
    return merged;
  }

  exists(): boolean {
    return fileExists(this.configPath);
  }

  init(): HiveConfig {
    if (!this.exists()) {
      return this.set(DEFAULT_HIVE_CONFIG);
    }
    return this.get();
  }

  getAgentConfig(
    agent: AgentName,
  ): { model?: string; temperature?: number; skills?: string[]; autoLoadSkills?: string[]; variant?: string } {
    const config = this.get();
    const agentConfig = config.agents?.[agent] ?? {};
    const defaultAutoLoadSkills = DEFAULT_HIVE_CONFIG.agents?.[agent]?.autoLoadSkills ?? [];
    const userAutoLoadSkills = agentConfig.autoLoadSkills ?? [];
    const isPlannerAgent = agent === 'hive-master' || agent === 'architect-planner';
    const effectiveUserAutoLoadSkills = isPlannerAgent
      ? userAutoLoadSkills
      : userAutoLoadSkills.filter((skill) => skill !== 'onboarding');
    const effectiveDefaultAutoLoadSkills = isPlannerAgent
      ? defaultAutoLoadSkills
      : defaultAutoLoadSkills.filter((skill) => skill !== 'onboarding');
    const combinedAutoLoadSkills = [...effectiveDefaultAutoLoadSkills, ...effectiveUserAutoLoadSkills];
    const uniqueAutoLoadSkills = Array.from(new Set(combinedAutoLoadSkills));
    const disabledSkills = (config.disableSkills ?? []).map(
      (skill) => SKILL_ALIASES[skill] ?? skill,
    );
    const effectiveAutoLoadSkills = uniqueAutoLoadSkills.filter(
      (skill) => !disabledSkills.includes(skill),
    );

    return {
      ...agentConfig,
      autoLoadSkills: effectiveAutoLoadSkills,
    };
  }

  getDisabledSkills(): string[] {
    const config = this.get();
    return config.disableSkills ?? [];
  }

  getDisabledMcps(): string[] {
    const config = this.get();
    return config.disableMcps ?? [];
  }

  getSandboxConfig(): SandboxConfig {
    const config = this.get();
    const mode = config.sandbox ?? 'none';
    const image = config.dockerImage;
    const persistent = config.persistentContainers ?? (mode === 'docker');

    return { mode, ...(image && { image }), persistent };
  }

  getHookCadence(hookName: string, options?: { safetyCritical?: boolean }): number {
    const config = this.get();
    const configuredCadence = config.hook_cadence?.[hookName];

    if (options?.safetyCritical && configuredCadence && configuredCadence > 1) {
      console.warn(
        `[maestro:cadence] Ignoring cadence > 1 for safety-critical hook: ${hookName}`
      );
      return 1;
    }

    if (configuredCadence === undefined || configuredCadence === null) {
      return 1;
    }
    if (configuredCadence <= 0 || !Number.isInteger(configuredCadence)) {
      console.warn(
        `[maestro:cadence] Invalid cadence ${configuredCadence} for ${hookName}, using 1`
      );
      return 1;
    }

    return configuredCadence;
  }
}
