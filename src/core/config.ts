/**
 * ConfigPort interface + FsConfigAdapter implementation.
 * Merged because config has a single implementation.
 * Config path: ~/.maestro/config.json (user-scoped, no directory arg).
 */

import * as path from 'path';
import { homedir } from 'os';
import { HiveConfig, DEFAULT_HIVE_CONFIG, AGENT_NAMES } from './types.ts';
import type { AgentName } from './types.ts';
import { ensureDir, readJson, writeJsonAtomic, fileExists } from './fs-io.ts';
import { SKILL_ALIASES } from '../skills/aliases.ts';

export interface ConfigPort {
  get(): HiveConfig;
}

export class FsConfigAdapter implements ConfigPort {
  private configPath: string;
  private cachedConfig: HiveConfig | null = null;

  constructor() {
    const configDir = path.join(homedir(), '.maestro');
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
    // Resolve old alias names to canonical names; unrecognized names pass through unchanged.
    const disabledSkills: string[] = (config.disableSkills ?? []).map(
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

}
